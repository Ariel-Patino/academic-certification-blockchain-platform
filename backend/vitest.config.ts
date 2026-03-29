import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      // Scope coverage to the HTTP/API surface currently exercised by tests.
      include: [
        "src/app.ts",
        "src/docs/swagger.ts",
        "src/routes/**/*.ts"
      ],
      exclude: [
        "node_modules",
        "dist",
        "**/*.test.ts",
        "**/*.spec.ts"
      ],
      all: true
    }
  }
});
