async function seed() {
  console.log("Seeding database...");

  // No default seed data needed - organization roles are managed by Better Auth plugin
  console.log("No seed data to insert. Roles are managed by the Organization plugin.");

  console.log("Seed completed");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
