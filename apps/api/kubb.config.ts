import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginZod } from "@kubb/plugin-zod";

export default defineConfig({
  input: {
    path: "./src/swagger.yaml",
  },
  output: {
    path: "./src/gen/kubb",
  },
  plugins: [
    // OpenAPI parser
    pluginOas(),

    // Generate TypeScript types for packages/types
    pluginTs({
      output: {
        path: "../../../../../packages/types/kubb",
      },
      // Exclude Better Auth wildcard routes (they have invalid param names)
      exclude: [
        { type: "path", pattern: "/api/auth" },
        { type: "path", pattern: "/v1/auth" },
      ],
    }),

    // Generate Zod schemas
    pluginZod({
      output: {
        path: "./zod",
      },
      // Exclude Better Auth wildcard routes
      exclude: [
        { type: "path", pattern: "/api/auth" },
        { type: "path", pattern: "/v1/auth" },
      ],
    }),

    // Generate React Query hooks for the frontend
    pluginReactQuery({
      output: {
        path: "../../../../web/src/kubb/hooks",
      },
      group: {
        type: "tag",
        name: ({ group }) => `${group}Hooks`,
      },
      client: {
        importPath: "@/lib/apiClient",
      },
      mutation: {
        methods: ["post", "put", "delete", "patch"],
      },
      query: {
        methods: ["get"],
        importPath: "@tanstack/react-query",
      },
      suspense: {},
      // Exclude Better Auth wildcard routes (they have invalid param names)
      exclude: [
        { type: "path", pattern: "/api/auth" },
        { type: "path", pattern: "/v1/auth" },
      ],
    }),
  ],
});
