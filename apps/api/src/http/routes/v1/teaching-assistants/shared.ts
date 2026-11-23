import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@repo/infra/db";
import { model, type TeachingAssistant } from "@repo/infra/db/schema";
import { LLMOverridesSchema } from "../../../../agents/llm-overrides";

// ==================== SCHEMAS ====================

/**
 * Per-assistant LLM parameters, validated with the same rules the LLM factory
 * applies. Model selection (`model`) is intentionally not configurable here.
 */
export const TeachingAssistantModelParametersSchema = LLMOverridesSchema.omit({
  model: true,
}).strict();

export type TeachingAssistantModelParameters = z.infer<
  typeof TeachingAssistantModelParametersSchema
>;

export const TeachingAssistantSchema = z.object({
  id: z.string(),
  alias: z.string(),
  version: z.number(),
  description: z.string().nullable(),
  systemPrompt: z.string(),
  targetAudience: z.string().nullable(),
  isActive: z.boolean(),
  organizationId: z.string().nullable(),
  modelParameters: TeachingAssistantModelParametersSchema.nullable(),
  activeChallengeCount: z.number(),
  /**
   * The organization default: its oldest active assistant, used by
   * challenges without a chosen one. Only coordinators and admins change it.
   */
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TeachingAssistantParamsSchema = z.object({
  id: z.string().min(1),
});

// ==================== HELPERS ====================

/**
 * Version marking a model row owned by exactly one assistant:
 * `ta:<assistantId>`, plus `:from:<modelId>` when it was copied from a shared
 * row, so clearing the parameters can restore that row.
 */
const privateModelPrefix = (teachingAssistantId: string) =>
  `ta:${teachingAssistantId}`;
const FROM_MARKER = ":from:";

function privateModelVersion(
  teachingAssistantId: string,
  fromModelId?: string
) {
  const prefix = privateModelPrefix(teachingAssistantId);
  return fromModelId ? `${prefix}${FROM_MARKER}${fromModelId}` : prefix;
}

function isPrivateModelOf(version: string, teachingAssistantId: string) {
  const prefix = privateModelPrefix(teachingAssistantId);
  return version === prefix || version.startsWith(`${prefix}${FROM_MARKER}`);
}

function sharedOrigin(version: string): string | null {
  const at = version.indexOf(FROM_MARKER);
  return at === -1 ? null : version.slice(at + FROM_MARKER.length);
}

/** Reads the stored parameters, keeping only keys the API exposes. */
export async function loadModelParameters(
  modelId: string | null
): Promise<TeachingAssistantModelParameters | null> {
  if (!modelId) return null;
  const [row] = await db
    .select({ modelParameters: model.modelParameters })
    .from(model)
    .where(eq(model.id, modelId))
    .limit(1);
  return parseModelParameters(row?.modelParameters);
}

/** Stored JSON -> API shape (unknown keys dropped, invalid data ignored). */
export function parseModelParameters(
  raw: unknown
): TeachingAssistantModelParameters | null {
  if (!raw) return null;
  const parsed = TeachingAssistantModelParametersSchema.strip().safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Stores the assistant's parameters without touching model rows shared with
 * other assistants (the global seed model, for instance): the assistant's own
 * model row is updated in place, otherwise a private copy is created.
 * `null` clears custom parameters: an assistant on a shared row keeps it, and
 * one on a private copy goes back to the shared row it was copied from (the
 * model link is never dropped). Returns the model id the assistant must
 * reference.
 */
export async function saveModelParameters(
  tx: Pick<typeof db, "select" | "insert" | "update">,
  teachingAssistantId: string,
  currentModelId: string | null,
  parameters: TeachingAssistantModelParameters | null
): Promise<string | null> {
  const [current] = currentModelId
    ? await tx
        .select({ id: model.id, name: model.name, version: model.version })
        .from(model)
        .where(eq(model.id, currentModelId))
        .limit(1)
    : [];
  const isPrivate =
    !!current && isPrivateModelOf(current.version, teachingAssistantId);

  if (!parameters) {
    if (!current || !isPrivate) return current?.id ?? null;
    const origin = sharedOrigin(current.version);
    if (origin) {
      const [shared] = await tx
        .select({ id: model.id })
        .from(model)
        .where(eq(model.id, origin))
        .limit(1);
      if (shared) return shared.id;
    }
    await tx
      .update(model)
      .set({ modelParameters: null })
      .where(eq(model.id, current.id));
    return current.id;
  }

  if (current && isPrivate) {
    await tx
      .update(model)
      .set({ modelParameters: parameters })
      .where(eq(model.id, current.id));
    return current.id;
  }

  // Reuses the private copy left behind by an earlier reset, if any.
  const [row] = await tx
    .insert(model)
    .values({
      id: randomUUID(),
      name: current?.name ?? "default",
      version: privateModelVersion(teachingAssistantId, current?.id),
      description: "Teaching assistant parameters",
      modelParameters: parameters,
    })
    .onConflictDoUpdate({
      target: [model.name, model.version],
      set: { modelParameters: parameters },
    })
    .returning({ id: model.id });
  return row!.id;
}

export function serializeTeachingAssistant(
  ta: TeachingAssistant,
  modelParameters: TeachingAssistantModelParameters | null,
  activeChallengeCount: number,
  isDefault: boolean
): z.infer<typeof TeachingAssistantSchema> {
  return {
    id: ta.id,
    alias: ta.alias,
    version: ta.version,
    description: ta.description,
    systemPrompt: ta.systemPrompt,
    targetAudience: ta.targetAudience,
    isActive: ta.isActive,
    organizationId: ta.createdByOrganizationId,
    modelParameters,
    activeChallengeCount,
    isDefault,
    createdAt: ta.createdAt.toISOString(),
    updatedAt: ta.updatedAt.toISOString(),
  };
}

/** Postgres unique-violation on the per-organization alias index. */
export function isAliasConflict(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export const ALIAS_CONFLICT_MESSAGE =
  "A teaching assistant with this name already exists in the organization";
