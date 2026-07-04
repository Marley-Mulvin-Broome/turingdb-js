import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    hookTimeout: 10_000,
    testTimeout: 1_000,
    globalSetup: ["tests/globalSetup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/types.ts", "src/interface.ts"],
      reporter: ["text", "json", "html"],
    },
  },
});
