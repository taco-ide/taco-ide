import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
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
// `password` is optional — when absent we generate a random one per row.
const REQUIRED_COLUMNS = ["name", "email", "role"] as const;
const GENERATED_PASSWORD_BYTES = 16;

// Header aliases let teachers upload CSVs exported from pt-BR spreadsheets
// without renaming columns. The keys are normalized forms (lowercase, no
// diacritics) of the headers, and the values are the canonical column
// names expected by the per-row Zod schema.
const HEADER_ALIASES: Record<string, string> = {
  // name
  name: "name",
  nome: "name",
  // email
  email: "email",
  "e-mail": "email",
  // password
  password: "password",
  senha: "password",
  // role
  role: "role",
  funcao: "role",
  papel: "role",
};

/**
 * Normalize a CSV header for alias lookup. Strips BOM, trims, lowercases,
 * and removes diacritics so `"Função"`, `"FUNÇÃO"`, and `"funcao"` all
 * collapse to the same key.
 */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Map a normalized header to its canonical column name, or return the
 * normalized form unchanged so unknown columns still flow through (they
 * are ignored later by the Zod schema).
 */
function canonicalHeader(raw: string): string {
  const normalized = normalizeHeader(raw);
  return HEADER_ALIASES[normalized] ?? normalized;
}

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

// Treat empty strings as "absent" so missing-password rows in CSVs that
// still include the column (e.g. `Nome,Email,Senha,Funcao` with the senha
// cell blank) flow through the optional path instead of failing the min
// length check.
const OptionalPasswordSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().min(12, "Password must be at least 12 characters").optional(),
);

const CsvRowSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .email("Invalid email format")
    .transform((value) => value.toLowerCase()),
  password: OptionalPasswordSchema,
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
        // Set only for `created` rows whose password was auto-generated
        // because the CSV omitted it. Surfaces the generated value to the
        // admin so they can share it out-of-band. Never emailed.
        generatedPassword: z.string().optional(),
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
  generatedPassword?: string;
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
          "Upload a CSV with columns name,email,role (and optional password) to bulk-create or link members in the organization. Headers are matched case-insensitively and accept pt-BR aliases (Nome, E-mail, Senha, Função/Papel). When a password is omitted the API auto-generates a random one and returns it via `generatedPassword` per row — share it with the user out-of-band. Best-effort processing: invalid rows are reported but do not block valid ones. Use ?dryRun=true to validate without persisting.",
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
      //  - `columns` callback runs each header through `canonicalHeader`
      //    so pt-BR variants (`Nome`, `Função`, `Senha`, `E-mail`),
      //    mixed-case headers (`Name`, `EMAIL`) and aliases all collapse
      //    to the canonical lowercase keys expected by the per-row Zod
      //    schema below.
      let records: Record<string, unknown>[];
      try {
        records = parseCsv(buffer, {
          bom: true,
          delimiter: [",", ";"],
          columns: (header: string[]) => header.map(canonicalHeader),
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

      // Track which rows had their password auto-generated so we can
      // surface the plaintext in the response report. Populated whether
      // or not we hit the persistence path (so dryRun previews can flag
      // it). Only generated values are stored — supplied passwords are
      // never echoed back.
      const generatedPasswords = new Map<number, string>();

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
        // Resolve each row's effective password up front so the
        // bounded-concurrency hashing loop below can run unchanged.
        // Rows whose CSV cell was blank get a `randomBytes`-derived
        // base64url string, and we remember the plaintext so we can
        // include it in the per-row report.
        const effectivePasswords = new Map<number, string>();
        for (const row of createRows) {
          if (row.data.password) {
            effectivePasswords.set(row.line, row.data.password);
            continue;
          }
          const generated = randomBytes(GENERATED_PASSWORD_BYTES).toString(
            "base64url",
          );
          effectivePasswords.set(row.line, generated);
          generatedPasswords.set(row.line, generated);
        }
        for (let i = 0; i < createRows.length; i += HASH_CONCURRENCY) {
          const chunk = createRows.slice(i, i + HASH_CONCURRENCY);
          const hashes = await Promise.all(
            chunk.map((r) => hashPassword(effectivePasswords.get(r.line)!)),
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

            const generated = generatedPasswords.get(row.line);
            persistResults.set(row.line, {
              line: row.line,
              email: row.data.email,
              status: row.kind === "create" ? "created" : "linked",
              ...(generated && row.kind === "create"
                ? {
                    generatedPassword: generated,
                    message:
                      "Password auto-generated — share it with the user out-of-band",
                  }
                : {}),
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
          // Flag rows that will get a generated password so the preview UI
          // can warn the admin before they confirm — we don't materialize
          // the actual value here because the hashing/generation runs only
          // on the persistence path.
          const willGeneratePassword =
            row.kind === "create" && !row.data.password;
          rowReports.set(row.line, {
            line: row.line,
            email: row.data.email,
            status: row.kind === "create" ? "created" : "linked",
            message: willGeneratePassword
              ? "Dry run — password will be auto-generated"
              : "Dry run — no changes persisted",
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
    return firstRow.map(canonicalHeader);
  } catch {
    return [];
  }
}
