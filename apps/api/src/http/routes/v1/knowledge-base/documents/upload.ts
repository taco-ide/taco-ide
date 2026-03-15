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
  challenge,
} from "@repo/infra/db/schema";
import { isSupportedMimeType, parseDocument } from "../../../../../services/document-parser";
import { chunkText } from "../../../../../services/chunking";
import { saveFile } from "../../../../../services/file-storage";
import { generateEmbedding } from "../../../../../services/embedding";

// ==================== SCHEMAS ====================

const DocumentSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  chunkCount: z.number(),
  status: z.enum(["processing", "ready", "error"]),
  createdAt: z.string(),
});

const UploadDocumentResponseSchema = z.object({
  success: z.literal(true),
  data: DocumentSchema,
});

// ==================== HELPERS ====================

interface DocumentRecord {
  id: string;
  challengeId: string;
  organizationId: string | null;
  classroomId: string | null;
}

async function processDocument(
  server: { log: { warn: (obj: object, msg: string) => void } },
  doc: DocumentRecord,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  try {
    const { text } = await parseDocument(buffer, mimeType);
    const chunks = chunkText(text);

    const chunkEntryIds: Array<{ entryId: string; content: string }> = [];

    await db.transaction(async (tx) => {
      for (const chunk of chunks) {
        const entryId = randomUUID();
        chunkEntryIds.push({ entryId, content: chunk.content });

        await tx.insert(knowledgeBase).values({
          id: entryId,
          challengeId: doc.challengeId,
          organizationId: doc.organizationId,
          classroomId: doc.classroomId,
          documentId: doc.id,
          chunkIndex: chunk.index,
          content: chunk.content,
        });
      }
    });

    // Fire-and-forget: generate embeddings outside the transaction
    for (const { entryId, content } of chunkEntryIds) {
      generateEmbedding(content)
        .then(async (embedding) => {
          if (embedding) {
            await db
              .update(knowledgeBase)
              .set({ embedding })
              .where(eq(knowledgeBase.id, entryId));
          }
        })
        .catch((err) =>
          server.log.warn(
            { err, knowledgeBaseEntryId: entryId, context: "chunk_embedding" },
            "Failed to generate embedding for document chunk"
          )
        );
    }

    await db
      .update(knowledgeBaseDocument)
      .set({ chunkCount: chunks.length, status: "ready" })
      .where(eq(knowledgeBaseDocument.id, doc.id));
  } catch (err) {
    await db
      .update(knowledgeBaseDocument)
      .set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      })
      .where(eq(knowledgeBaseDocument.id, doc.id));
  }
}

// ==================== ROUTE ====================

export async function uploadDocumentRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: { id: string };
  }>(
    "/",
    {
      preHandler: [requirePermission("knowledgeBase", "create")],
      schema: {
        tags: ["knowledge-base"],
        summary: "Upload document to knowledge base",
        description:
          "Upload a document (PDF, TXT, MD) to be parsed and added to the challenge knowledge base",
        params: z.object({ id: z.string().uuid() }),
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

      const challengeId = request.params.id;

      const ch = await db
        .select({
          id: challenge.id,
          classroomId: challenge.classroomId,
          createdByUserId: challenge.createdByUserId,
        })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      if (usr.role === "teacher" && ch[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message:
            "You can only manage knowledge base entries for your own challenges",
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
      if (!isSupportedMimeType(mimeType)) {
        return reply.status(400).send({
          success: false as const,
          message: `Unsupported file type: ${mimeType}. Supported: application/pdf, text/plain, text/markdown`,
        });
      }

      const buffer = await file.toBuffer();

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(413).send({
          success: false as const,
          message: "File exceeds maximum size of 10MB",
        });
      }

      const organizationId = usr.activeOrganizationId;
      if (!organizationId) {
        return reply.status(400).send({
          success: false as const,
          message: "User must have an active organization",
        });
      }

      const classroomId = ch[0].classroomId;
      const docId = randomUUID();

      const [docRecord] = await db
        .insert(knowledgeBaseDocument)
        .values({
          id: docId,
          organizationId,
          classroomId,
          challengeId,
          filename: file.filename,
          mimeType,
          fileSize: buffer.length,
          status: "processing",
        })
        .returning();

      if (!docRecord) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create document record",
        });
      }

      // Save file to disk
      await saveFile(buffer, organizationId, docId, file.filename);

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
            challengeId: docRecord.challengeId ?? challengeId,
            organizationId: docRecord.organizationId,
            classroomId: docRecord.classroomId,
          },
          buffer,
          mimeType
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
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(knowledgeBaseDocument.id, docRecord.id));
      });

      return reply.status(202).send({
        success: true as const,
        data: {
          id: docRecord.id,
          challengeId: docRecord.challengeId ?? challengeId,
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
