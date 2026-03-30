/**
 * Base seed: model + teaching assistant padrao.
 * Compartilhado entre dev e prod.
 */
import { db } from "../index";
import { model, teachingAssistant } from "../schema";

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
  console.log("[base] Seeding default model and teaching assistant...");

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

  console.log("[base] Model and teaching assistant seeded.");
}
