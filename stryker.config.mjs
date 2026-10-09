// Mutation testing (Stryker) para la lógica de negocio pura y la seguridad.
// Ejecución: nightly (.github/workflows/nightly.yml, job mutation).
// Solo corre contra el proyecto de tests "unit" (los tests de integración
// necesitan Supabase local y no forman parte de la medición de mutantes).

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
    related: false,
  },
  // Sin tests de integración: solo tests unitarios que no requieren Docker.
  testFiles: [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "!src/**/*.rpc.test.ts",
    "!src/**/*.integration.test.ts",
  ],
  mutate: [
    "src/features/*/domain/**/*.ts",
    "src/infra/security/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.test.tsx",
  ],
  reporters: ["html", "clear-text"],
  htmlReporter: {
    fileName: "reports/mutation/mutation.html",
  },
  thresholds: {
    high: 80,
    low: 60,
    // Umbral de ruptura: por debajo de este score Stryker termina con error.
    break: 50,
  },
  // Artefactos generados por otros controles: no deben copiarse al sandbox
  // (escriben en paralelo y provocan carreras de copia).
  ignorePatterns: [
    ".claude",
    ".agents",
    ".husky",
    ".quality",
    ".stryker-tmp",
    "reports",
    "coverage",
    ".next",
    ".lighthouseci",
    "playwright-report",
    "test-results",
    "e2e",
    "supabase",
    "docs",
    "public",
  ],
  tempDirName: ".stryker-tmp",
  incremental: false,
  // Los mutantes estáticos (inicializadores de módulo, constantes) multiplicaban por ~10 el tiempo
  // sin aportar señal de tests; se excluyen. Nightly corre en ubuntu-latest (4 vCPU).
  ignoreStatic: true,
  concurrency: 4,
  // La batería unit completa (~2.700 tests) tarda ~5 min solo en la ejecución inicial en Windows;
  // el valor por defecto de Stryker (5 min) cortaba la ejecución antes de medir mutantes.
  dryRunTimeoutMinutes: 15,
};

export default config;
