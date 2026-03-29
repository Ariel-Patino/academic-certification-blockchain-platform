import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: "./coverage",
      include: [
        "services/api.ts",
        "services/web3Errors.ts",
        "services/verificationSchema.ts",
        "lib/constants.ts"
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx"]
    }
  }
});
