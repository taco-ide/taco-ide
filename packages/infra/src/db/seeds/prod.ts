/**
 * Seed de producao: apenas model + teaching assistant padrao.
 * Sem usuarios, orgs, turmas ou desafios de teste.
 *
 * Rode: cd packages/infra && npm run db:seed:prod
 */
import { seedBase } from "./base";

console.log("Running production seed...");

async function seed() {
  await seedBase();

  console.log("[prod] Seed completed.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
