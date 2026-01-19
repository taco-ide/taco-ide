import app from "./http/server";

const port = process.env.PORT ? Number(process.env.PORT) : 3333;

const startServer = () => {
  app
    .listen({
      port,
      host: "0.0.0.0",
    })
    .then(() => {
      console.log(`🚀 HTTP server running on http://localhost:${port}`);
      console.log(`📚 Swagger docs available at http://localhost:${port}/docs`);
    })
    .catch((err) => {
      console.error("Error starting server:", err);
      process.exit(1);
    });
};

startServer();

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
