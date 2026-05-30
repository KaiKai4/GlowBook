import { expect, test } from "@playwright/test";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "../src/test/supabase-integration-fixtures";

let admin: TestSupabaseClient | null = null;
let fixture: SalonOwnerFixture | null = null;

test.describe("disabled salon features", () => {
  test.beforeAll(async () => {
    const env = getSupabaseIntegrationEnv();
    if (!env) return;

    admin = createIntegrationAdminClient(env);
    fixture = await createSalonOwnerFixture(admin, "E2E Disabled", ["appointments"]);
  });

  test.afterAll(async () => {
    if (admin) await cleanupSalonOwnerFixture(admin, fixture);
  });

  test("hides disabled Modules from navigation and denies direct route access", async ({ page }) => {
    test.skip(!fixture, "Requires Supabase service role fixture env.");
    const activeFixture = fixture!;

    await page.goto("/login");
    await page.getByLabel("Email").fill(activeFixture.email);
    await page.getByLabel(/Contrase/i).fill(activeFixture.password);
    await page.getByRole("button", { name: /Iniciar/i }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: /Citas/i })).toHaveCount(0);

    await page.goto("/appointments");
    await expect(page.getByText(/No tienes permiso para ver las citas/i)).toBeVisible();
  });
});
