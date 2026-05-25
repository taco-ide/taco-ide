/**
 * Base seed: dados ESTRUTURAIS que existem em QUALQUER ambiente.
 * - Model LLM padrao
 * - Teaching Assistant padrao
 *
 * Idempotente via safeInsert (ignora conflitos).
 * Pode ser rodado standalone: npm run db:seed
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../index";
import { model, teachingAssistant } from "../schema";
import { seedPlatformAdmin } from "./admin";

// --- IDs fixos (reprodutiveis) ---
export const SEED_MODEL_ID = "00000000-0000-0000-0000-000000000001";
export const SEED_TA_ID = "00000000-0000-0000-0000-000000000002";

export async function safeInsert<T>(label: string, fn: () => Promise<T>) {
  try {
    await fn();
  } catch (e) {
    console.warn(`  [skip] ${label}:`, e instanceof Error ? e.message : e);
  }
}

type SeedBaseOptions = {
  organizationId?: string;
};

export async function seedBase({ organizationId }: SeedBaseOptions = {}) {
  console.log("[base] Seeding structural data (model + teaching assistant)...");

  await safeInsert("model", () =>
    db.insert(model).values({
      id: SEED_MODEL_ID,
      version: "1.0",
      name: "gpt-4o-mini",
      description: "OpenAI GPT-4o Mini for coding assistance",
    })
  );

  await safeInsert("teachingAssistant", () =>
    db.insert(teachingAssistant).values({
      id: SEED_TA_ID,
      alias: "TACO Assistant",
      version: 1,
      modelId: SEED_MODEL_ID,
      systemPrompt:
        "You are a helpful programming tutor. Guide students to find solutions without giving away the answer directly. Use the Socratic method.",
      description: "Default teaching assistant for TACO-IDE",
      targetAudience: "beginner",
      isActive: true,
      ...(organizationId ? { createdByOrganizationId: organizationId } : {}),
    })
  );

  // If the row already existed without an org binding (e.g., base seed ran
  // before the dev seed), bind it to the supplied org so org-scoped lookups
  // in the API can resolve a TA.
  // The isNull guard prevents overwriting an already-bound org on repeated invocations.
  if (organizationId) {
    await safeInsert("teachingAssistant org backfill", () =>
      db
        .update(teachingAssistant)
        .set({ createdByOrganizationId: organizationId })
        .where(
          and(
            eq(teachingAssistant.id, SEED_TA_ID),
            isNull(teachingAssistant.createdByOrganizationId)
          )
        )
    );
  }

  console.log("[base] Structural data seeded.");

  await seedPlatformAdmin();
}

// --- Standalone execution ---
const isMain =
  process.argv[1]?.endsWith("seeds/base.ts") ||
  process.argv[1]?.endsWith("seeds/base");

if (isMain) {
  seedBase()
    .then(() => {
      console.log("[base] Done.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Base seed failed:", error);
      process.exit(1);
    });
}
