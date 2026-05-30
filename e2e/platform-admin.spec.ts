import { expect, test } from "@playwright/test";
import {
  cleanupPlatformAdminFixture,
  createIntegrationAdminClient,
  createPlatformAdminFixture,
  getSupabaseIntegrationEnv,
  type AuthCredentials,
  type PlatformAdminFixture,
  type TestSupabaseClient,
} from "../src/test/supabase-integration-fixtures";

let credentials: AuthCredentials | null =
  process.env.E2E_PLATFORM_ADMIN_EMAIL && process.env.E2E_PLATFORM_ADMIN_PASSWORD
    ? {
        email: process.env.E2E_PLATFORM_ADMIN_EMAIL,
        password: process.env.E2E_PLATFORM_ADMIN_PASSWORD,
      }
    : null;

let admin: TestSupabaseClient | null = null;
let fixture: PlatformAdminFixture | null = null;

test.describe("platform admin critical smoke", () => {
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
    test.skip(
      !credentials,
      "Requires E2E_PLATFORM_ADMIN_* credentials or Supabase service role fixture env."
    );
    const activeCredentials = credentials!;

    await page.goto("/login");
    await page.getByLabel("Email").fill(activeCredentials.email);
    await page.getByLabel(/Contrase/i).fill(activeCredentials.password);
    await page.getByRole("button", { name: /Iniciar/i }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Panel de Plataforma/i })).toBeVisible();
  });
});
