import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import { FastifyRequest, FastifyReply } from "fastify";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema413,
} from "../../../_responses/types";
import { hasMinimumRole, hashPassword } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { account, member, user } from "@repo/infra/db/schema";

// ==================== CONSTANTS ====================

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
// Synchronous credential hashing (scrypt is CPU-bound) caps how many rows
// we can practically process per request without blocking the event loop
// for tens of seconds. Keep this conservative; bulk imports beyond this
// should be split or moved to a background job.
const MAX_ROWS = 100;
const HASH_CONCURRENCY = 8;
const REQUIRED_COLUMNS = ["name", "email", "password", "role"] as const;

// ==================== SCHEMAS ====================

const ImportCsvParamsSchema = z.object({
  id: z.string().min(1),
});

const ImportCsvQuerySchema = z
  .object({
    dryRun: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .strict();

const RoleEnum = z.enum(["student", "teacher", "coordinator", "admin"]);

const CsvRowSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .email("Invalid email format")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12, "Password must be at least 12 characters"),
  role: RoleEnum,
});

type CsvRow = z.infer<typeof CsvRowSchema>;

const ImportCsvResponseSchema = ResponseSchema200.extend({
  data: z.object({
    dryRun: z.boolean(),
    summary: z.object({
      total: z.number(),
      created: z.number(),
      linked: z.number(),
      skipped: z.number(),
      errors: z.number(),
    }),
    rows: z.array(
      z.object({
        line: z.number(),
        email: z.string(),
        status: z.enum(["created", "linked", "skipped", "error"]),
        message: z.string().optional(),
      })
    ),
  }),
});

// ==================== TYPES ====================

type RowReport = {
  line: number;
  email: string;
  status: "created" | "linked" | "skipped" | "error";
  message?: string;
};

type ParsedRow = {
  line: number;
  raw: Record<string, unknown>;
};

type ValidatedRow = {
  line: number;
  data: CsvRow;
};

// ==================== AUTHORIZATION HELPER ====================

/**
 * Allows the request when the user is a platform admin OR has at least
 * coordinator role on the target organization (active organization must
 * match the path parameter for the role check).
 */
function requirePlatformAdminOrCoordinator() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const usr = request.user;
    if (!usr) {
      return reply.status(401).send({
        success: false as const,
        message: "Not authenticated",
      });
    }

    if (usr.isPlatformAdmin) {
      return;
    }

    const params = request.params as { id?: string };
    const organizationId = params.id;

    if (!usr.activeOrganizationId || !usr.role) {
      return reply.status(403).send({
        success: false as const,
        message: "No active organization selected",
      });
    }

    if (organizationId !== usr.activeOrganizationId) {
      return reply.status(403).send({
        success: false as const,
        message: "Organization ID must match your active organization",
      });
    }

    if (!hasMinimumRole(usr.role, "coordinator")) {
      return reply.status(403).send({
        success: false as const,
        message: "Insufficient role permissions",
      });
    }
  };
}

// ==================== ROUTE ====================

export async function importCsvMembersRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof ImportCsvParamsSchema>;
    Querystring: z.infer<typeof ImportCsvQuerySchema>;
  }>(
    "/members/import-csv",
    {
      preHandler: [requirePlatformAdminOrCoordinator()],
      schema: {
        tags: ["organizations"],
        summary: "Bulk import members from a CSV file",
        description:
          "Upload a CSV with columns name,email,password,role to bulk-create or link members in the organization. Best-effort processing: invalid rows are reported but do not block valid ones. Use ?dryRun=true to validate without persisting.",
        consumes: ["multipart/form-data"],
        params: ImportCsvParamsSchema,
        querystring: ImportCsvQuerySchema,
        response: {
          200: ImportCsvResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          413: ResponseSchema413,
        },
      },
    },
    async (request, reply) => {
      const { id: organizationId } = request.params;
      const dryRun = request.query.dryRun ?? false;

      // ---- 1. Read the multipart file -------------------------------------
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({
          success: false as const,
          message: "No file uploaded",
        });
      }

      const filename = file.filename ?? "";
      if (!filename.toLowerCase().endsWith(".csv")) {
        return reply.status(400).send({
          success: false as const,
          message: "File must have a .csv extension",
        });
      }

      const buffer = await file.toBuffer();
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(413).send({
          success: false as const,
          message: "CSV file exceeds maximum size of 1MB",
        });
      }

      // ---- 2. Parse the CSV ----------------------------------------------
      // Tolerate real-world CSVs produced by spreadsheet apps:
      //  - `bom: true` strips the UTF-8 BOM that Excel (pt-BR) prepends, so
      //    the first header doesn't end up as "﻿name".
      //  - `delimiter: [",", ";"]` lets the parser auto-pick between the
      //    US locale (",") and the European/Excel pt-BR locale (";").
      //  - `columns` callback lowercases header names so headers like
      //    `NAME,Email,Role` match the lowercase keys expected by the
      //    per-row Zod schema below.
      let records: Record<string, unknown>[];
      try {
        records = parseCsv(buffer, {
          bom: true,
          delimiter: [",", ";"],
          columns: (header: string[]) =>
            header.map((h) => h.trim().toLowerCase()),
          skip_empty_lines: true,
          trim: true,
        }) as Record<string, unknown>[];
      } catch (err) {
        return reply.status(400).send({
          success: false as const,
          message:
            err instanceof Error
              ? `Failed to parse CSV: ${err.message}`
              : "Failed to parse CSV",
        });
      }

      // ---- 3. Validate header --------------------------------------------
      const header = records[0]
        ? Object.keys(records[0])
        : extractHeaderFromBuffer(buffer);
      const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col));
      if (missing.length > 0) {
        return reply.status(400).send({
          success: false as const,
          message: `Missing required column(s): ${missing.join(", ")}`,
        });
      }

      // ---- 4. Enforce row limit ------------------------------------------
      if (records.length > MAX_ROWS) {
        return reply.status(413).send({
          success: false as const,
          message: `CSV exceeds maximum of ${MAX_ROWS} rows`,
        });
      }

      // ---- 5. Per-row Zod validation -------------------------------------
      // Header is line 1, so the first data row is line 2.
      const parsedRows: ParsedRow[] = records.map((raw, index) => ({
        line: index + 2,
        raw,
      }));

      const rowReports = new Map<number, RowReport>();
      const validatedRows: ValidatedRow[] = [];

      for (const { line, raw } of parsedRows) {
        const result = CsvRowSchema.safeParse(raw);
        const fallbackEmail =
          typeof raw.email === "string" ? raw.email : "";

        if (!result.success) {
          const message = result.error.issues
            .map((issue) => {
              const path = issue.path.join(".") || "row";
              return `${path}: ${issue.message}`;
            })
            .join("; ");
          rowReports.set(line, {
            line,
            email: fallbackEmail,
            status: "error",
            message,
          });
          continue;
        }

        validatedRows.push({ line, data: result.data });
      }

      // Detect duplicate emails inside the same CSV: keep the first
      // occurrence as the source of truth, mark later ones as errors.
      const seenEmails = new Map<string, number>();
      const dedupedRows: ValidatedRow[] = [];
      for (const row of validatedRows) {
        const previousLine = seenEmails.get(row.data.email);
        if (previousLine !== undefined) {
          rowReports.set(row.line, {
            line: row.line,
            email: row.data.email,
            status: "error",
            message: `Duplicate email in CSV (first seen on line ${previousLine})`,
          });
          continue;
        }
        seenEmails.set(row.data.email, row.line);
        dedupedRows.push(row);
      }

      // ---- 6. Bulk lookup of existing users + memberships ---------------
      const emails = dedupedRows.map((row) => row.data.email);

      const existingUsers =
        emails.length === 0
          ? []
          : await db
              .select({ id: user.id, email: user.email })
              .from(user)
              .where(inArray(user.email, emails));

      const userIdByEmail = new Map<string, string>();
      for (const u of existingUsers) {
        userIdByEmail.set(u.email, u.id);
      }

      const existingUserIds = existingUsers.map((u) => u.id);
      const existingMembers =
        existingUserIds.length === 0
          ? []
          : await db
              .select({ userId: member.userId })
              .from(member)
              .where(
                and(
                  eq(member.organizationId, organizationId),
                  inArray(member.userId, existingUserIds)
                )
              );

      const memberUserIds = new Set(existingMembers.map((m) => m.userId));

      // ---- 7. Categorize rows --------------------------------------------
      type CategorizedRow =
        | { kind: "create"; line: number; data: CsvRow }
        | { kind: "link"; line: number; data: CsvRow; userId: string }
        | { kind: "skip"; line: number; data: CsvRow };

      const categorized: CategorizedRow[] = dedupedRows.map(({ line, data }) => {
        const existingId = userIdByEmail.get(data.email);
        if (existingId) {
          if (memberUserIds.has(existingId)) {
            return { kind: "skip", line, data };
          }
          return { kind: "link", line, data, userId: existingId };
        }
        return { kind: "create", line, data };
      });

      // ---- 8. Persist (unless dryRun) ------------------------------------
      const persistResults = new Map<number, RowReport>();

      if (!dryRun) {
        // Pre-hash passwords for new users OUTSIDE the transaction.
        // scrypt is intentionally CPU-intensive; running it inside the
        // transaction would hold a DB connection and locks for the entire
        // hashing window, exhausting the pool and stalling unrelated
        // queries. We process the hashes in bounded-concurrency chunks
        // (HASH_CONCURRENCY) so the request latency improves without
        // letting a single import saturate the event loop.
        const hashedPasswords = new Map<number, string>();
        const createRows = categorized.filter(
          (r): r is Extract<CategorizedRow, { kind: "create" }> =>
            r.kind === "create"
        );
        for (let i = 0; i < createRows.length; i += HASH_CONCURRENCY) {
          const chunk = createRows.slice(i, i + HASH_CONCURRENCY);
          const hashes = await Promise.all(
            chunk.map((r) => hashPassword(r.data.password))
          );
          chunk.forEach((r, idx) => hashedPasswords.set(r.line, hashes[idx]!));
        }

        // One transaction per row so a single failure (e.g. a unique
        // constraint slipping past the pre-check due to a race) does not
        // abort the whole import. This matches the documented
        // "best-effort processing" contract: invalid rows are reported
        // but do not block valid ones.
        for (const row of categorized) {
          if (row.kind === "skip") {
            continue;
          }

          try {
            await db.transaction(async (tx) => {
              if (row.kind === "create") {
                const newUserId = randomUUID();
                const passwordHash = hashedPasswords.get(row.line);
                if (!passwordHash) {
                  throw new Error(
                    `Missing pre-computed password hash for line ${row.line}`
                  );
                }

                await tx.insert(user).values({
                  id: newUserId,
                  name: row.data.name,
                  email: row.data.email,
                  emailVerified: true,
                  isActive: true,
                  isPlatformAdmin: false,
                });

                await tx.insert(account).values({
                  id: randomUUID(),
                  accountId: row.data.email,
                  providerId: "credential",
                  userId: newUserId,
                  password: passwordHash,
                });

                await tx.insert(member).values({
                  id: randomUUID(),
                  userId: newUserId,
                  organizationId,
                  role: row.data.role,
                });
                return;
              }

              // kind === "link"
              await tx.insert(member).values({
                id: randomUUID(),
                userId: row.userId,
                organizationId,
                role: row.data.role,
              });
            });

            persistResults.set(row.line, {
              line: row.line,
              email: row.data.email,
              status: row.kind === "create" ? "created" : "linked",
            });
          } catch (err) {
            request.server.log.error(
              { err, organizationId, line: row.line, email: row.data.email },
              "CSV import row failed"
            );
            persistResults.set(row.line, {
              line: row.line,
              email: row.data.email,
              status: "error",
              message:
                err instanceof Error
                  ? err.message.slice(0, 200)
                  : "Failed to persist row",
            });
          }
        }
      }

      // ---- 9. Build the per-row report -----------------------------------
      for (const row of categorized) {
        if (rowReports.has(row.line)) {
          continue;
        }

        if (row.kind === "skip") {
          rowReports.set(row.line, {
            line: row.line,
            email: row.data.email,
            status: "skipped",
            message: "User is already a member of this organization",
          });
          continue;
        }

        if (dryRun) {
          rowReports.set(row.line, {
            line: row.line,
            email: row.data.email,
            status: row.kind === "create" ? "created" : "linked",
            message: "Dry run — no changes persisted",
          });
          continue;
        }

        const persisted = persistResults.get(row.line);
        if (persisted) {
          rowReports.set(row.line, persisted);
        }
      }

      const rows = Array.from(rowReports.values()).sort(
        (a, b) => a.line - b.line
      );

      const summary = rows.reduce(
        (acc, row) => {
          acc.total += 1;
          if (row.status === "created") acc.created += 1;
          else if (row.status === "linked") acc.linked += 1;
          else if (row.status === "skipped") acc.skipped += 1;
          else acc.errors += 1;
          return acc;
        },
        { total: 0, created: 0, linked: 0, skipped: 0, errors: 0 }
      );

      return reply.status(200).send({
        success: true as const,
        data: {
          dryRun,
          summary,
          rows,
        },
      });
    }
  );
}

// ==================== INTERNAL HELPERS ====================

/**
 * When `csv-parse` returns zero records the file might still have a
 * header row. Pull it from the raw buffer to give a useful 400 message
 * about missing columns versus an empty file.
 */
function extractHeaderFromBuffer(buffer: Buffer): string[] {
  try {
    const headerOnly = parseCsv(buffer, {
      bom: true,
      delimiter: [",", ";"],
      columns: false,
      skip_empty_lines: true,
      trim: true,
      to_line: 1,
    }) as string[][];
    const firstRow = headerOnly[0] ?? [];
    return firstRow.map((h) => h.trim().toLowerCase());
  } catch {
    return [];
  }
}
