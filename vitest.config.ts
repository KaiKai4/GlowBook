import path from "node:path";
import { defineConfig } from "vitest/config";

// Pruebas de integración: requieren Supabase local (Docker). Si falta el
// entorno deben FALLAR, nunca saltarse. Por eso no usan skip condicional.
const UNIT_EXCLUDE = ["src/**/*.rpc.test.ts", "src/**/*.integration.test.ts"];

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [...UNIT_EXCLUDE],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: [
            "src/**/*.rpc.test.ts",
            "src/**/*.integration.test.ts",
          ],
          testTimeout: 60000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/types/**",
      ],
      reporter: ["text-summary", "json-summary", "json", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
