/**
 * Apaga os schemas `public` e `drizzle` e recria `public` vazio.
 *
 * O Drizzle Kit grava `__drizzle_migrations` no schema `drizzle`; se só apagar
 * `public`, `migrate` acha que já rodou tudo e não recria as tabelas do app.
 *
 * Rode via: npm run db:reset — não execute em produção.
 */
import postgres from "postgres";
import { env } from "../env";

async function resetDb() {
  console.warn(
    "\n⚠️  RESET: DROP schemas public + drizzle — todos os dados serão apagados.\n"
  );

  const sql = postgres(env.DATABASE_URL, { max: 1 });

  try {
    await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await sql.unsafe("CREATE SCHEMA public");
    await sql.unsafe("GRANT ALL ON SCHEMA public TO public");
    // Garante que o usuário da conexão tenha uso do schema (útil fora do role postgres)
    await sql.unsafe(
      `GRANT ALL ON SCHEMA public TO CURRENT_USER`
    );
    console.log("✓ Schemas drizzle (removido) e public recriado.\n");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

resetDb().catch((err) => {
  console.error("reset-db falhou:", err);
  process.exit(1);
});
