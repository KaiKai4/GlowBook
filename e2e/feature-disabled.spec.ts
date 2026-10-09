import { expect, test } from "@playwright/test";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "../src/test/supabase-integration-fixtures";
import { expectNoSeriousA11yViolations } from "./support/a11y";
import { skipUnlessReady } from "./support/env";

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
    skipUnlessReady(!fixture, "Requires Supabase service role fixture env.");
    const activeFixture = fixture!;

    await page.goto("/login");
    await page.getByLabel(/Correo|Email/i).fill(activeFixture.email);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(activeFixture.password);
    await page.getByRole("button", { name: /Iniciar/i }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: /Citas/i })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    await page.goto("/appointments");
    await expect(page.getByText(/No tienes permiso para ver las citas/i)).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
