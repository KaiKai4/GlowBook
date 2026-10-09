import path from "node:path";
import { defineConfig } from "vitest/config";

// Pruebas de integración: requieren Supabase local (Docker). Si falta el
// entorno deben FALLAR, nunca saltarse. Por eso no usan skip condicional.
const UNIT_EXCLUDE = ["src/**/*.rpc.test.ts", "src/**/*.integration.test.ts"];

// Zona horaria fija para que local y CI (runners en UTC) den el mismo resultado:
// una prueba que dependa de la zona de la máquina debe fallar también en local.
process.env.TZ = "UTC";

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
          testTimeout: 15000,
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
