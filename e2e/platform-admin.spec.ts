import { expect, test, type Page } from "@playwright/test";
import {
  cleanupPlatformAdminFixture,
  createIntegrationAdminClient,
  createPlatformAdminFixture,
  getSupabaseIntegrationEnv,
  type AuthCredentials,
  type PlatformAdminFixture,
  type TestSupabaseClient,
} from "../src/test/supabase-integration-fixtures";
import { expectNoSeriousA11yViolations } from "./support/a11y";
import { skipUnlessReady } from "./support/env";

let credentials: AuthCredentials | null =
  process.env.E2E_PLATFORM_ADMIN_EMAIL && process.env.E2E_PLATFORM_ADMIN_PASSWORD
    ? {
        email: process.env.E2E_PLATFORM_ADMIN_EMAIL,
        password: process.env.E2E_PLATFORM_ADMIN_PASSWORD,
      }
    : null;

let admin: TestSupabaseClient | null = null;
let fixture: PlatformAdminFixture | null = null;

async function loginPlatformAdmin(page: Page) {
  const activeCredentials = credentials!;

  await page.goto("/login");
  await page.getByLabel(/Correo|Email/i).fill(activeCredentials.email);
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(activeCredentials.password);
  await page.getByRole("button", { name: /Iniciar/i }).click();
}

test.describe("platform admin critical smoke", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    if (credentials) return;

    const env = getSupabaseIntegrationEnv();
    if (!env) return;

    admin = createIntegrationAdminClient(env);
    fixture = await createPlatformAdminFixture(admin);
    credentials = { email: fixture.email, password: fixture.password };
  });

  test.afterAll(async () => {
    if (admin) await cleanupPlatformAdminFixture(admin, fixture);
  });

  test("logs in and opens the Platform admin home", async ({ page }) => {
    skipUnlessReady(
      !credentials,
      "Requires E2E_PLATFORM_ADMIN_* credentials or Supabase service role fixture env."
    );

    await loginPlatformAdmin(page);

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Panel de Plataforma/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("opens the Platform audit log", async ({ page }) => {
    skipUnlessReady(
      !credentials,
      "Requires E2E_PLATFORM_ADMIN_* credentials or Supabase service role fixture env."
    );

    await loginPlatformAdmin(page);
    // Hay dos accesos a /admin/audit (barra lateral y tarjeta del inicio); ambos llevan al mismo destino.
    await page.getByRole("link", { name: /Auditoria/i }).first().click();

    await expect(page).toHaveURL(/\/admin\/audit/);
    await expect(page.getByRole("heading", { name: /Auditoria de Plataforma/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("opens the Platform invitations page", async ({ page }) => {
    skipUnlessReady(
      !credentials,
      "Requires E2E_PLATFORM_ADMIN_* credentials or Supabase service role fixture env."
    );

    await loginPlatformAdmin(page);
    await page.getByRole("link", { name: /Invitaciones/i }).click();

    await expect(page).toHaveURL(/\/admin\/invitations/);
    await expect(page.getByRole("heading", { name: /^Invitaciones$/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
