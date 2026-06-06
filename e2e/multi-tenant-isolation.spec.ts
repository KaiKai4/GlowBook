import { expect, test, type Page } from "@playwright/test";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createSalonOwnerFixture,
  createScheduledAppointmentFixture,
  getSupabaseIntegrationEnv,
  type AppointmentFixture,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "../src/test/supabase-integration-fixtures";

let admin: TestSupabaseClient | null = null;
let salonA: SalonOwnerFixture | null = null;
let salonB: SalonOwnerFixture | null = null;
let salonBAppointment: AppointmentFixture | null = null;

async function loginAsSalonA(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/Correo|Email/i).fill(salonA!.email);
  await page
    .getByRole("textbox", { name: "Contraseña", exact: true })
    .fill(salonA!.password);
  await page.getByRole("button", { name: /Iniciar/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe("multi-tenant isolation", () => {
  test.beforeAll(async () => {
    const env = getSupabaseIntegrationEnv();
    if (!env) return;

    admin = createIntegrationAdminClient(env);
    salonA = await createSalonOwnerFixture(admin, "E2E Tenant A");
    salonB = await createSalonOwnerFixture(admin, "E2E Tenant B");
    salonBAppointment = await createScheduledAppointmentFixture(admin, salonB, {
      daysAhead: 25,
      hour: 14,
      notes: "E2E tenant B private appointment",
    });
  });

  test.afterAll(async () => {
    if (!admin) return;
    await cleanupSalonOwnerFixture(admin, salonA);
    await cleanupSalonOwnerFixture(admin, salonB);
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!salonA || !salonB || !salonBAppointment, "Requires Supabase service role fixture env.");
    await loginAsSalonA(page);
  });

  test("denies direct access to another Salon employee detail", async ({ page }) => {
    const response = await page.goto(`/employees/${salonB!.employeeId}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText("E2E Tenant B")).toHaveCount(0);
    await expect(page.getByText(salonB!.email)).toHaveCount(0);
  });

  test("denies direct access to another Salon appointment edit screen", async ({ page }) => {
    const response = await page.goto(
      `/appointments/${salonBAppointment!.appointmentId}/edit`
    );

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/tenant B private appointment/i)).toHaveCount(0);
    await expect(page.getByText("E2E Tenant B")).toHaveCount(0);
  });

  test("keeps Platform admin routes unavailable to a Salon owner", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).not.toHaveURL(/\/admin$/);
    await expect(page.getByText(/Plataforma|Salones|Invitaciones/i)).toHaveCount(0);
  });
});
