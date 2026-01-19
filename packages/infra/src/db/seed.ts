import { db } from "./index";
import { role } from "./schema";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create default roles
  const existingRoles = await db.select().from(role);

  if (existingRoles.length === 0) {
    await db.insert(role).values([{ name: "student" }, { name: "professor" }]);
    console.log("✅ Roles created: student, professor");
  } else {
    console.log("ℹ️ Roles already exist, skipping...");
  }

  console.log("✅ Seed completed");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
