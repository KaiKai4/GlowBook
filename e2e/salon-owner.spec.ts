import { expect, test, type Page } from "@playwright/test";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createSalonOwnerFixture,
  createScheduledAppointmentFixture,
  getSupabaseIntegrationEnv,
  type AuthCredentials,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "../src/test/supabase-integration-fixtures";
import { expectNoSeriousA11yViolations } from "./support/a11y";
import { isLocalTarget, skipUnlessReady } from "./support/env";
import { readLocalFixtures } from "./support/local-fixtures";
import { loginWith } from "./support/login";
import { futureDate, selectCalendarDate } from "./support/calendar";

let credentials: AuthCredentials | null =
  process.env.E2E_SALON_OWNER_EMAIL && process.env.E2E_SALON_OWNER_PASSWORD
    ? {
        email: process.env.E2E_SALON_OWNER_EMAIL,
        password: process.env.E2E_SALON_OWNER_PASSWORD,
      }
    : process.env.SUPABASE_TEST_EMAIL && process.env.SUPABASE_TEST_PASSWORD
      ? {
          email: process.env.SUPABASE_TEST_EMAIL,
          password: process.env.SUPABASE_TEST_PASSWORD,
        }
      : null;

let admin: TestSupabaseClient | null = null;
let fixture: SalonOwnerFixture | null = null;

// El Select del proyecto (src/components/ui/select.tsx) es un combobox: el disparador
// es un botón etiquetado y las opciones son role="option" dentro de un listbox en portal.
async function selectFirstRealOption(page: Page, label: string | RegExp) {
  const trigger = page.getByLabel(label, { exact: typeof label === "string" });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await page.getByRole("listbox").getByRole("option", { disabled: false }).first().click();
  await expect(trigger).not.toHaveText(/^Selecciona/i);
}

test.describe("salon owner critical smoke", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({}, workerInfo) => {
    // En local el owner lo crea global-setup; su fixture completo viaja por env.
    // El proyecto "mobile" usa un salón propio: no comparte los datos que muta el de escritorio.
    if (isLocalTarget) {
      const owners = readLocalFixtures();
      fixture = workerInfo.project.name === "mobile" ? owners.salonOwnerMobile : owners.salonOwnerA;
      credentials = { email: fixture.email, password: fixture.password };
      admin = createIntegrationAdminClient(getSupabaseIntegrationEnv());
      return;
    }

    if (credentials) return;

    const env = getSupabaseIntegrationEnv();
    if (!env) return;

    admin = createIntegrationAdminClient(env);
    fixture = await createSalonOwnerFixture(admin, "E2E");
    credentials = { email: fixture.email, password: fixture.password };
  });

  test.afterAll(async () => {
    // En local la limpieza del owner A la hace el teardown global.
    if (admin && !isLocalTarget) await cleanupSalonOwnerFixture(admin, fixture);
  });

  test.beforeEach(async ({ page }) => {
    skipUnlessReady(
      !credentials,
      "Requires E2E_SALON_OWNER_* credentials or Supabase service role fixture env."
    );
    await loginWith(page, credentials!.email, credentials!.password);
  });

  test("loads the dashboard shell and visible salon Modules", async ({ page }) => {
    await expect(page.getByText("GlowBook").first()).toBeVisible();

    const modules = [
      { label: "Citas", path: "/appointments" },
      { label: "Clientes", path: "/customers" },
      { label: "Colaboradores", path: "/employees" },
      { label: "Servicios", path: "/services" },
      { label: "Reportes", path: "/reports" },
      { label: "Roles", path: "/roles" },
      { label: "Plantillas", path: "/plantillas" },
      { label: "Salon", path: "/salon" },
    ];

    for (const feature of modules) {
      const link = page.getByRole("link", { name: new RegExp(feature.label, "i") });
      if ((await link.count()) === 0) {
        if (isLocalTarget) {
          throw new Error(`Módulo "${feature.label}" no visible para el owner en modo local.`);
        }
        continue;
      }

      await link.first().click();
      await expect(page).toHaveURL(new RegExp(feature.path));
      await expect(page.locator("h1, h2").first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    }
  });

  test("reaches the appointment creation entry point when appointments are enabled", async ({ page }) => {
    const appointmentsLink = page.getByRole("link", { name: /Citas/i });
    skipUnlessReady(
      (await appointmentsLink.count()) === 0,
      "Appointments Module is not visible for this user."
    );

    await appointmentsLink.first().click();
    await page.goto("/appointments/new");
    await expect(page).toHaveURL(/\/appointments\/new/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("creates a valid appointment from the browser flow", async ({ page }) => {
    const appointmentsLink = page.getByRole("link", { name: /Citas/i });
    skipUnlessReady(
      (await appointmentsLink.count()) === 0,
      "Appointments Module is not visible for this user."
    );

    await page.goto("/appointments/new");
    await expect(page.getByRole("heading", { name: /Seleccionar cliente/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await selectFirstRealOption(page, "Cliente");
    await page.getByRole("button", { name: /Continuar/i }).click();

    await selectCalendarDate(page, "Fecha", futureDate());
    await page.getByLabel("Hora de inicio").click();
    const timeDialog = page.getByRole("dialog", { name: "Seleccionar hora" });
    await expect(timeDialog).toBeVisible();
    await page
      .getByRole("listbox", { name: "Hora" })
      .getByRole("option", { name: "10", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Minutos" })
      .getByRole("option", { name: "00", exact: true })
      .click();
    await page
      .getByRole("radiogroup", { name: "Periodo" })
      .getByRole("radio", { name: "AM", exact: true })
      .click();
    await timeDialog.getByRole("button", { name: "Guardar" }).click();
    await selectFirstRealOption(page, "Categoria");
    await selectFirstRealOption(page, "Servicio");
    await selectFirstRealOption(page, "Profesional");
    await page.getByRole("button", { name: /Continuar/i }).click();

    await expect(page.getByRole("heading", { name: /Confirmar cita/i })).toBeVisible();
    await page.getByLabel(/Notas/i).fill("E2E cita valida");
    await page.getByRole("button", { name: /Confirmar cita/i }).click();

    await expect(page).toHaveURL(/\/appointments$/);
    await expect(page.getByRole("heading", { name: /Agenda/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("creates an appointment with a new customer from the browser flow", async ({ page }) => {
    const appointmentsLink = page.getByRole("link", { name: /Citas/i });
    skipUnlessReady(
      (await appointmentsLink.count()) === 0,
      "Appointments Module is not visible for this user."
    );

    await page.goto("/appointments/new");
    await expect(page.getByRole("heading", { name: /Seleccionar cliente/i })).toBeVisible();

    const uniqueName = `E2E Nuevo ${Date.now()}`;
    await page.getByRole("button", { name: "Cliente nuevo" }).click();
    await page.getByLabel("Nombre").fill(uniqueName);
    await page.getByLabel("Apellido").fill("Prueba");
    await page.getByRole("button", { name: /Continuar/i }).click();

    await selectCalendarDate(page, "Fecha", futureDate());
    await page.getByLabel("Hora de inicio").click();
    const timeDialog = page.getByRole("dialog", { name: "Seleccionar hora" });
    await expect(timeDialog).toBeVisible();
    await page
      .getByRole("listbox", { name: "Hora" })
      .getByRole("option", { name: "11", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Minutos" })
      .getByRole("option", { name: "00", exact: true })
      .click();
    await page
      .getByRole("radiogroup", { name: "Periodo" })
      .getByRole("radio", { name: "AM", exact: true })
      .click();
    await timeDialog.getByRole("button", { name: "Guardar" }).click();
    await selectFirstRealOption(page, "Categoria");
    await selectFirstRealOption(page, "Servicio");
    await selectFirstRealOption(page, "Profesional");
    await page.getByRole("button", { name: /Continuar/i }).click();

    await expect(page.getByRole("heading", { name: /Confirmar cita/i })).toBeVisible();
    await page.getByRole("button", { name: /Confirmar cita/i }).click();

    await expect(page).toHaveURL(/\/appointments$/);
    await expect(page.getByRole("heading", { name: /Agenda/i })).toBeVisible();
  });

  test("completes an appointment from the agenda with success feedback", async ({ page }) => {
    skipUnlessReady(!admin || !fixture, "Requires Supabase service role fixture env.");
    const activeAdmin = admin!;
    const activeFixture = fixture!;

    const appointmentToComplete = await createScheduledAppointmentFixture(activeAdmin, activeFixture, {
      daysAhead: 21,
      hour: 15,
      notes: "E2E lifecycle complete",
    });

    await page.goto("/appointments");
    await selectCalendarDate(
      page,
      "Fecha de la agenda",
      appointmentToComplete.startDate
    );
    await page.getByRole("button", { name: /^Completar$/i }).click();

    const completeDialog = page.getByRole("dialog", { name: "Completar cita" });
    await expect(completeDialog).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await completeDialog
      .getByRole("button", { name: /Cobrar y completar/i })
      .click();

    await expect(
      completeDialog.getByRole("button", { name: "Cita completada" })
    ).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(completeDialog).toBeHidden();
  });

  // La reactivación no se cubre: customers/page.tsx fija status "active", así que la
  // vista de archivados no es alcanzable desde la UI (ver informe de la ronda 2).
  test("archives a customer from the customer screens", async ({ page }) => {
    skipUnlessReady(!fixture, "Requires Supabase service role fixture env.");

    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: /Clientes/i })).toBeVisible();
    await expect(page.getByText("E2E Cliente")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: /^Editar$/i }).first().click();
    await expect(page.getByRole("heading", { name: /Editar cliente/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: /^Eliminar$/i }).click();
    // Archivar pide confirmación en un diálogo propio de la app, no en un diálogo nativo.
    const archiveDialog = page.getByRole("dialog", { name: /Archivar cliente/i });
    await expect(archiveDialog).toBeVisible();
    await archiveDialog.getByRole("button", { name: /^Archivar$/i }).click();
    await expect(page.getByRole("heading", { name: /Editar cliente/i })).toBeHidden();

    await page.goto("/customers");
    await expect(page.getByText("E2E Cliente")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("generates an employee invitation link from the employee detail screen", async ({ page }) => {
    skipUnlessReady(!fixture, "Requires Supabase service role fixture env.");
    const activeFixture = fixture!;

    await page.goto(`/employees/${activeFixture.employeeId}`);
    await expect(page.getByRole("heading", { name: /E2E Colaborador/i })).toBeVisible();
    await expect(page.getByText(/Acceso al sistema/i)).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const generateButton = page.getByRole("button", { name: /Generar enlace de acceso/i });
    if ((await generateButton.count()) > 0) {
      await generateButton.click();
    } else {
      await page.getByRole("button", { name: /Regenerar enlace/i }).click();
    }

    await expect(page.getByText(/Enlace generado/i)).toBeVisible();
    const inviteUrl = await page.locator("input[readonly]").last().inputValue();
    expect(inviteUrl).toContain("/join/");
    await expectNoSeriousA11yViolations(page);
  });

});

// signOut() es global (revoca todas las sesiones del usuario): va con un owner propio,
// nunca con el de la caché del resto de specs.
test.describe("cierre de sesión", () => {
  test("signs out and returns to login", async ({ page }) => {
    skipUnlessReady(!isLocalTarget, "El cierre de sesión usa el owner local de global-setup.");
    const owner = readLocalFixtures().salonOwnerSignOut;
    await loginWith(page, owner.email, owner.password, { fresh: true });

    await page.getByRole("button", { name: /Cerrar sesi/i }).first().click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /Iniciar/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
