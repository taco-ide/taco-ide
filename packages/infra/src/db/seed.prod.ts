import { db } from "./index";
import { model, teachingAssistant } from "./schema";

// ==================== PROD SEED ====================
// Creates only core structural data needed for the platform to function.
// No test users, orgs, classrooms, or challenges.

const SEED_MODEL_ID = "00000000-0000-0000-0000-000000000001";
const SEED_TA_ID = "00000000-0000-0000-0000-000000000002";

async function seed() {
  console.log("[prod] Seeding database...");

  // ==================== DEFAULT MODEL ====================
  try {
    await db.insert(model).values({
      id: SEED_MODEL_ID,
      version: "1.0",
      name: "gpt-4o-mini",
      description: "OpenAI GPT-4o Mini for coding assistance",
    });
  } catch {
    // Model may already exist
  }

  // ==================== DEFAULT TEACHING ASSISTANT ====================
  try {
    await db.insert(teachingAssistant).values({
      id: SEED_TA_ID,
      alias: "TACO Assistant",
      version: 1,
      modelId: SEED_MODEL_ID,
      systemPrompt:
        "You are a helpful programming tutor. Guide students to find solutions without giving away the answer directly. Use the Socratic method.",
      description: "Default teaching assistant for TACO-IDE",
      targetAudience: "beginner",
      isActive: true,
    });
  } catch {
    // TA may already exist
  }

  console.log("[prod] Seed completed - default model and TA created");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
