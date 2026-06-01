import app from "./http/server";
import { env } from "@repo/infra/env";
import { recoverStaleRunningJobs } from "./http/services/job-recovery";

const port = env.PORT;

const startServer = async () => {
  try {
    // Reset jobs left in `running` by a previous process before serving (#95).
    // Best-effort: a DB hiccup here must not block startup.
    try {
      const recovered = await recoverStaleRunningJobs();
      if (recovered.submissions || recovered.referenceSolutions) {
        console.log(
          `♻️  Recovered ${recovered.submissions} auto-review(s) and ${recovered.referenceSolutions} reference-solution(s) stuck in "running" after restart`
        );
      }
    } catch (err) {
      console.error("Failed to recover stale running jobs:", err);
    }

    await app.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 HTTP server running on http://localhost:${port}`);
    console.log(`📚 Swagger docs available at http://localhost:${port}/docs`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

void startServer();

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
