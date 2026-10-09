import { defineConfig, devices } from "@playwright/test";

// Dos modos de ejecución:
//  - Local (GLOWBOOK_TEST_TARGET=local): app servida con `next start` sobre la
//    build de producción y Supabase local (Docker). Requiere `npm run build`
//    previo; el runner de calidad (scripts/quality/verify.mjs) inyecta el entorno.
//  - Staging (E2E_BASE_URL + bypass de Vercel): no levanta servidor. Se mantiene
//    intacto para `npm run test:e2e:staging`.
const isLocalTarget = process.env.GLOWBOOK_TEST_TARGET === "local";
const isStagingTarget = Boolean(process.env.E2E_BASE_URL);

if (!isLocalTarget && !isStagingTarget) {
  throw new Error(
    "Playwright necesita GLOWBOOK_TEST_TARGET=local (Supabase local) o E2E_BASE_URL (staging). " +
      'Para local ejecuta "npm run build" y después "node scripts/quality/verify.mjs --step e2e".'
  );
}

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const extraHTTPHeaders = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? {
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      "x-vercel-set-bypass-cookie": "true",
    }
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: isLocalTarget ? "./e2e/global-setup.ts" : undefined,
  use: {
    baseURL,
    extraHTTPHeaders,
    trace: "on-first-retry",
  },
  // En local la build ya debe existir (`npm run build`): `next start` no compila.
  webServer: isStagingTarget
    ? undefined
    : {
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
  ],
});
