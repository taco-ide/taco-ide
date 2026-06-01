import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@repo/infra/db": path.resolve(__dirname, "../../packages/infra/src/db"),
      "@repo/infra/db/schema": path.resolve(
        __dirname,
        "../../packages/infra/src/db/schema"
      ),
      "@repo/infra/auth": path.resolve(
        __dirname,
        "../../packages/infra/src/auth"
      ),
      "@repo/infra/env": path.resolve(__dirname, "../../packages/infra/src/env"),
    },
  },
});
