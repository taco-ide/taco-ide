/**
 * Seed de producao: base + dados especificos de prod (se houver).
 * Por enquanto, executa apenas os dados estruturais.
 *
 * Rode: cd packages/infra && npm run db:seed:prod
 */
import { seedBase } from "./base";

async function seed() {
  console.log("[prod] Running production seed...");

  // --- 1. Base: dados estruturais (model + TA) ---
  await seedBase();

  // --- 2. Dados especificos de producao (adicionar aqui conforme necessidade) ---
  // Exemplo futuro: planos, configuracoes de billing, etc.

  console.log("[prod] Seed completed.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Prod seed failed:", error);
  process.exit(1);
});
