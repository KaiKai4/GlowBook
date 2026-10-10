import { defineConfig, devices } from "@playwright/test";

// Modo único: local (GLOWBOOK_TEST_TARGET=local). La app se sirve con `next start`
// sobre la build de producción y Supabase local (Docker). Requiere `npm run build`
// previo; el runner de calidad (scripts/quality/verify.mjs) inyecta el entorno.
// No hay modo staging: los E2E nunca apuntan a un entorno remoto.
if (process.env.GLOWBOOK_TEST_TARGET !== "local") {
  throw new Error(
    'Playwright necesita GLOWBOOK_TEST_TARGET=local (Supabase local). ' +
      'Ejecútalo con "node scripts/quality/verify.mjs --step e2e" (tras "npm run build").'
  );
}

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Un test que solo pasa al reintentar falla el job (los flaky no pasan en silencio).
  failOnFlakyTests: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // En local la build ya debe existir (`npm run build`): `next start` no compila.
  webServer: {
    command: `npx next start -p ${port} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Proyecto móvil: smoke críticos, auditoría de accesibilidad y layout en Pixel 7.
    {
      // Se ejecuta tras "chromium" para no solapar dos runs de los mismos salones de E2E.
      name: "mobile",
      dependencies: ["chromium"],
      use: { ...devices["Pixel 7"] },
      testMatch: /(accessibility-sweep|responsive-layout|salon-owner|auth|platform-admin)\.spec\.ts$/,
    },
  ],
});
