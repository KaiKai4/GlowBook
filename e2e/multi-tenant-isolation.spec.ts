import { expect, test, type Page } from "@playwright/test";
import {
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createScheduledAppointmentFixture,
  getSupabaseIntegrationEnv,
  type AppointmentFixture,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "../src/test/supabase-integration-fixtures";
import { skipUnlessReady } from "./support/env";
import { readLocalFixtures } from "./support/local-fixtures";
import { loginWith } from "./support/login";

// Los salones A y B los crea global-setup (y su limpieza corre en el teardown global).
let admin: TestSupabaseClient | null = null;
let salonA: SalonOwnerFixture | null = null;
let salonB: SalonOwnerFixture | null = null;
let salonBAppointment: AppointmentFixture | null = null;
// Textos del salón B que no deben aparecer en ninguna respuesta al owner A.
let tenantBTexts: string[] = [];

// Texto del 404 global del proyecto (src/app/not-found.tsx).
const NOT_FOUND_TEXT = "Página no encontrada";

async function loginAsSalonA(page: Page) {
  await loginWith(page, salonA!.email, salonA!.password);
}

/**
 * Con streaming (src/app/(dashboard)/loading.tsx), notFound() responde HTTP 200
 * porque el shell ya se envió; el status deja de ser una señal fiable. Ver
 * node_modules/next/dist/docs/01-app/02-guides/streaming.md, sección "The HTTP contract".
 * La propiedad de seguridad se comprueba por contenido: UI de not-found, meta
 * robots noindex y ausencia de datos del otro salón.
 */
async function expectNotFoundWithoutTenantBData(page: Page) {
  await expect(page.getByText(NOT_FOUND_TEXT, { exact: true })).toBeVisible();
  // Next puede emitir la meta robots más de una vez: ninguna debe carecer de noindex.
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="robots"]:not([content*="noindex"])')).toHaveCount(0);

  const html = await page.content();
  for (const text of tenantBTexts) {
    expect(html, `No debe aparecer "${text}" del salón B`).not.toContain(text);
  }
}

test.describe("multi-tenant isolation", () => {
  // Serial: el beforeAll inserta una cita en el salón B; en paralelo chocaría con
  // la exclusión no_overlap_per_employee al repetirse en cada worker.
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const fixtures = readLocalFixtures();
    admin = createIntegrationAdminClient(getSupabaseIntegrationEnv());
    salonA = fixtures.salonOwnerA;
    salonB = fixtures.salonOwnerB;
    salonBAppointment = await createScheduledAppointmentFixture(admin, salonB, {
      daysAhead: 25,
      hour: 14,
      notes: "E2E tenant B private appointment",
    });

    const { data: serviceB, error: serviceError } = await admin
      .from("services")
      .select("name")
      .eq("id", salonB.serviceId)
      .single();
    if (serviceError) throw serviceError;

    tenantBTexts = [
      "E2E Tenant B",
      salonB.email,
      "E2E tenant B private appointment",
      serviceB.name,
    ];
  });

  test.beforeEach(async ({ page }) => {
    skipUnlessReady(!salonA || !salonB || !salonBAppointment, "Requires Supabase service role fixture env.");
    await loginAsSalonA(page);
  });

  test("denies direct access to another Salon employee detail", async ({ page }) => {
    await page.goto(`/employees/${salonB!.employeeId}`);

    await expectNotFoundWithoutTenantBData(page);
  });

  test("denies direct access to another Salon appointment edit screen", async ({ page }) => {
    await page.goto(`/appointments/${salonBAppointment!.appointmentId}/edit`);

    await expectNotFoundWithoutTenantBData(page);
  });

  test("RLS hides the Salon B rows from the Salon A owner session", async () => {
    const owner = salonA;
    const other = salonB;
    if (!owner || !other) throw new Error("Fixtures E2E de salones A/B ausentes para RLS.");

    // Cliente con la sesión real del owner A (anon key + JWT), no service role.
    const userClient = createIntegrationUserClient(getSupabaseIntegrationEnv());
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    expect(signInError).toBeNull();

    // Control positivo: el owner A sí ve su propio salón; así el resultado vacío
    // del salón B no puede deberse a un login fallido.
    const { data: ownSalon, error: ownError } = await userClient
      .from("salons")
      .select("id")
      .eq("id", owner.salonId);
    expect(ownError).toBeNull();
    expect(ownSalon).toHaveLength(1);

    const { data: salonBRows, error: salonBError } = await userClient
      .from("salons")
      .select("id")
      .eq("id", other.salonId);
    expect(salonBError).toBeNull();
    expect(salonBRows).toEqual([]);

    const { data: employeeBRows, error: employeeBError } = await userClient
      .from("employees")
      .select("id")
      .eq("id", other.employeeId);
    expect(employeeBError).toBeNull();
    expect(employeeBRows).toEqual([]);
    // Sin signOut(): revocaría todas las sesiones del owner A, que otros specs usan en paralelo.
  });

  test("keeps Platform admin routes unavailable to a Salon owner", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).not.toHaveURL(/\/admin$/);
    await expect(page.getByText(/Plataforma|Salones|Invitaciones/i)).toHaveCount(0);
  });
});
