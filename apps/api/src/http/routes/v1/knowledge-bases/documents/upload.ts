import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema413,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import {
  knowledgeBase,
  knowledgeBaseDocument,
  knowledgeBaseChunk,
} from "@repo/infra/db/schema";
import { parseDocument } from "../../../../../services/document-parser";
import { chunkText } from "../../../../../services/chunking";
import { saveFile } from "../../../../../services/file-storage";
import { generateEmbeddings } from "../../../../../services/embedding";

// ==================== SCHEMAS ====================

const UploadDocumentParamsSchema = z.object({
  kbId: z.string().min(1),
});

const DocumentSchema = z.object({
  id: z.string(),
  knowledgeBaseId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  chunkCount: z.number(),
  status: z.string(),
  createdAt: z.string(),
});

const UploadDocumentResponseSchema = z.object({
  success: z.literal(true),
  data: DocumentSchema,
});

// ==================== HELPERS ====================

interface DocumentRecord {
  id: string;
  knowledgeBaseId: string;
  organizationId: string;
}

async function processDocument(
  server: { log: { warn: (obj: object, msg: string) => void } },
  doc: DocumentRecord,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<void> {
  // Stage: converting
  await db
    .update(knowledgeBaseDocument)
    .set({ status: "converting", updatedAt: new Date() })
    .where(eq(knowledgeBaseDocument.id, doc.id));

  let text: string;
  try {
    const result = await parseDocument(buffer, mimeType, filename);
    text = result.text;
  } catch (err) {
    await db
      .update(knowledgeBaseDocument)
      .set({
        status: "error",
        errorStage: "converting",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBaseDocument.id, doc.id));
    return;
  }

  // Stage: chunking
  await db
    .update(knowledgeBaseDocument)
    .set({ status: "chunking", updatedAt: new Date() })
    .where(eq(knowledgeBaseDocument.id, doc.id));

  let chunks: ReturnType<typeof chunkText>;
  try {
    chunks = chunkText(text, 3200, 800, filename);
  } catch (err) {
    await db
      .update(knowledgeBaseDocument)
      .set({
        status: "error",
        errorStage: "chunking",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBaseDocument.id, doc.id));
    return;
  }

  // Insert chunks
  const chunkEntries: Array<{ chunkId: string; content: string }> = [];

  await db.transaction(async (tx) => {
    for (const chunk of chunks) {
      const chunkId = randomUUID();
      chunkEntries.push({ chunkId, content: chunk.content });

      await tx.insert(knowledgeBaseChunk).values({
        id: chunkId,
        knowledgeBaseId: doc.knowledgeBaseId,
        documentId: doc.id,
        chunkIndex: chunk.index,
        content: chunk.content,
        metadata: chunk.metadata ?? null,
      });
    }
  });

  // Stage: embedding
  await db
    .update(knowledgeBaseDocument)
    .set({ status: "embedding", chunkCount: chunks.length, updatedAt: new Date() })
    .where(eq(knowledgeBaseDocument.id, doc.id));

  try {
    const contents = chunkEntries.map((e) => e.content);
    const embeddings = await generateEmbeddings(contents);

    let embeddedCount = 0;
    for (let i = 0; i < chunkEntries.length; i++) {
      const embedding = embeddings[i];
      if (embedding) {
        await db
          .update(knowledgeBaseChunk)
          .set({ embedding })
          .where(eq(knowledgeBaseChunk.id, chunkEntries[i]!.chunkId));
        embeddedCount++;
      }
    }

    if (embeddedCount === 0 && chunkEntries.length > 0) {
      await db
        .update(knowledgeBaseDocument)
        .set({
          status: "error",
          errorStage: "embedding",
          errorMessage:
            "Embedding service unavailable. Check EMBEDDING_API_URL and EMBEDDING_API_KEY configuration.",
          updatedAt: new Date(),
        })
        .where(eq(knowledgeBaseDocument.id, doc.id));
      return;
    }
  } catch (err) {
    await db
      .update(knowledgeBaseDocument)
      .set({
        status: "error",
        errorStage: "embedding",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBaseDocument.id, doc.id));
    return;
  }

  // Stage: ready
  await db
    .update(knowledgeBaseDocument)
    .set({ status: "ready", errorStage: null, errorMessage: null, updatedAt: new Date() })
    .where(eq(knowledgeBaseDocument.id, doc.id));
}

// ==================== ROUTE ====================

export async function uploadDocumentRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof UploadDocumentParamsSchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("knowledgeBase", "create")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Upload document to knowledge base",
        description:
          "Upload a document to be parsed and added to the knowledge base. Supports any format convertible by Pandoc.",
        params: UploadDocumentParamsSchema,
        response: {
          202: UploadDocumentResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          413: ResponseSchema413,
        },
      },
    },
    async (request, reply) => {
      const usr = request.user;
      if (!usr) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { kbId } = request.params;

      const kb = await db
        .select({
          id: knowledgeBase.id,
          organizationId: knowledgeBase.organizationId,
          createdByUserId: knowledgeBase.createdByUserId,
        })
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.id, kbId), isNull(knowledgeBase.deletedAt)))
        .limit(1);

      if (!kb[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base not found",
        });
      }

      if (kb[0].organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Knowledge base does not belong to your active organization",
        });
      }

      if (usr.role === "teacher" && kb[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only upload documents to your own knowledge bases",
        });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({
          success: false as const,
          message: "No file uploaded",
        });
      }

      const mimeType = file.mimetype;

      const buffer = await file.toBuffer();

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(413).send({
          success: false as const,
          message: "File exceeds maximum size of 10MB",
        });
      }

      const organizationId = kb[0].organizationId;
      const docId = randomUUID();

      const [docRecord] = await db
        .insert(knowledgeBaseDocument)
        .values({
          id: docId,
          knowledgeBaseId: kbId,
          filename: file.filename,
          mimeType,
          fileSize: buffer.length,
          status: "uploading",
        })
        .returning();

      if (!docRecord) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create document record",
        });
      }

      // Save file to disk
      await saveFile(buffer, organizationId, kbId, docId, file.filename);

      // Fire-and-forget: process document (parse, chunk, embed)
      const PROCESSING_TIMEOUT = 60_000; // 60s
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Document processing timeout (60s)")),
          PROCESSING_TIMEOUT
        )
      );

      Promise.race([
        processDocument(
          request.server,
          {
            id: docRecord.id,
            knowledgeBaseId: kbId,
            organizationId,
          },
          buffer,
          mimeType,
          file.filename
        ),
        timeoutPromise,
      ]).catch(async (err) => {
        request.server.log.warn(
          { err, documentId: docRecord.id },
          "Document processing failed"
        );
        await db
          .update(knowledgeBaseDocument)
          .set({
            status: "error",
            errorStage: "uploading",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(knowledgeBaseDocument.id, docRecord.id));
      });

      return reply.status(202).send({
        success: true as const,
        data: {
          id: docRecord.id,
          knowledgeBaseId: kbId,
          filename: docRecord.filename,
          mimeType: docRecord.mimeType,
          fileSize: docRecord.fileSize,
          chunkCount: docRecord.chunkCount,
          status: docRecord.status,
          createdAt: docRecord.createdAt.toISOString(),
        },
      });
    }
  );
}
