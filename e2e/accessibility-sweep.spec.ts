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
import { expectNoSeriousA11yViolations } from "./support/a11y";
import { selectCalendarDate } from "./support/calendar";
import { isLocalTarget, skipUnlessReady } from "./support/env";
import { loginWith } from "./support/login";
import {
  cleanupLimitedCollaboratorFixture,
  createLimitedCollaboratorFixture,
  type LimitedCollaboratorFixture,
} from "./support/limited-collaborator";
import { readLocalFixtures } from "./support/local-fixtures";
import { LIMITED_SCREENS, OWNER_SCREENS, PLATFORM_SCREENS } from "./support/routes";

// Auditoría de accesibilidad (axe, impactos serious/critical) de todas las pantallas
// por perfil, con los diálogos y pestañas abiertos. Corre en escritorio y en el proyecto "mobile".
// Solo local. Cada bloque crea su propio salón para no interferir con otros specs.

const TOKEN = "token-invalido-e2e";
const PUBLIC_SCREENS = ["/login", "/forgot-password", "/reset-password", `/invite/${TOKEN}`, `/join/${TOKEN}`];

let admin: TestSupabaseClient | null = null;
let ownerFixture: SalonOwnerFixture | null = null;
let limited: LimitedCollaboratorFixture | null = null;

function getAdmin(): TestSupabaseClient {
  admin ??= createIntegrationAdminClient(getSupabaseIntegrationEnv());
  return admin;
}

/**
 * Cita nueva en un día aleatorio lejano y a una hora de la jornada (America/Panama),
 * para que aparezca en la agenda y no choque con otras citas del colaborador.
 */
async function createAuditAppointment(fixture: SalonOwnerFixture, notes: string): Promise<AppointmentFixture> {
  const daysAhead = 60 + Math.floor(Math.random() * 300);
  const hour = 15 + Math.floor(Math.random() * 4);
  return createScheduledAppointmentFixture(getAdmin(), fixture, { daysAhead, hour, notes });
}

/** Abre el diálogo cuyo botón tiene el nombre dado, lo audita y lo cierra con Escape. */
async function auditDialog(page: Page, buttonName: RegExp): Promise<void> {
  await page.getByRole("button", { name: buttonName }).first().click();
  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

/** Cambia al formulario de la pestaña dada (botón de pestaña) y lo audita. */
async function auditTab(page: Page, tabName: RegExp): Promise<void> {
  await page.getByRole("button", { name: tabName }).first().click();
  await expectNoSeriousA11yViolations(page);
}

/** Navega a una pantalla del panel y espera su encabezado antes de auditarla. */
async function auditScreen(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator("h1, h2").first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
}

test.describe("accesibilidad: salón owner", () => {
  test.beforeAll(async () => {
    if (!isLocalTarget) return;
    ownerFixture = await createSalonOwnerFixture(getAdmin(), "E2E a11y owner");
  });

  test.afterAll(async () => {
    if (admin && ownerFixture) await cleanupSalonOwnerFixture(admin, ownerFixture);
  });

  test.beforeEach(async ({ page }) => {
    skipUnlessReady(!isLocalTarget, "La auditoría de accesibilidad requiere el stack local.");
    expect(ownerFixture).not.toBeNull();
    await loginWith(page, ownerFixture!.email, ownerFixture!.password);
  });

  for (const screen of OWNER_SCREENS) {
    test(`owner ${screen.path} sin violaciones serias o críticas`, async ({ page }) => {
      await auditScreen(page, screen.path);
      for (const dialog of screen.dialogs ?? []) {
        await auditDialog(page, dialog);
      }
      for (const tab of screen.tabs ?? []) {
        await auditTab(page, tab);
      }
    });
  }

  test("owner /appointments/[id]/edit", async ({ page }) => {
    const appointment = await createAuditAppointment(ownerFixture!, "E2E a11y editar");
    await auditScreen(page, `/appointments/${appointment.appointmentId}/edit`);
  });

  test("owner: diálogo cancelar cita desde la agenda", async ({ page }) => {
    const appointment = await createAuditAppointment(ownerFixture!, "E2E a11y cancelar");
    await page.goto("/appointments");
    await selectCalendarDate(page, "Fecha de la agenda", appointment.startDate);
    // El menú de acciones de la fila contiene "Cancelar", que abre el diálogo "Cancelar cita".
    await page.getByRole("button", { name: "Abrir acciones de cita" }).first().click();
    await page.getByRole("button", { name: /^Cancelar$/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Cancelar cita" });
    await expect(dialog).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("owner: diálogo completar cita desde la agenda", async ({ page }) => {
    const appointment = await createAuditAppointment(ownerFixture!, "E2E a11y completar");
    await page.goto("/appointments");
    await selectCalendarDate(page, "Fecha de la agenda", appointment.startDate);
    await auditDialog(page, /^Completar$/);
  });
});

test.describe("accesibilidad: colaborador con permisos limitados", () => {
  test.beforeAll(async () => {
    if (!isLocalTarget) return;
    ownerFixture = await createSalonOwnerFixture(getAdmin(), "E2E a11y colaborador");
    limited = await createLimitedCollaboratorFixture(getAdmin(), ownerFixture.salonId);
  });

  test.afterAll(async () => {
    if (admin && limited) await cleanupLimitedCollaboratorFixture(admin, limited);
    if (admin && ownerFixture) await cleanupSalonOwnerFixture(admin, ownerFixture);
  });

  test.beforeEach(async ({ page }) => {
    skipUnlessReady(!isLocalTarget, "La auditoría de accesibilidad requiere el stack local.");
    expect(limited).not.toBeNull();
    await loginWith(page, limited!.email, limited!.password);
  });

  for (const path of LIMITED_SCREENS) {
    test(`colaborador ${path} sin violaciones serias o críticas`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");
      await expectNoSeriousA11yViolations(page);
    });
  }
});

test.describe("accesibilidad: platform admin", () => {
  test.beforeEach(async ({ page }) => {
    skipUnlessReady(!isLocalTarget, "La auditoría de accesibilidad requiere el stack local.");
    const platformAdmin = readLocalFixtures().platformAdmin;
    await loginWith(page, platformAdmin.email, platformAdmin.password);
  });

  for (const screen of PLATFORM_SCREENS) {
    test(`platform ${screen.path} sin violaciones serias o críticas`, async ({ page }) => {
      await auditScreen(page, screen.path);
    });
  }
});

test.describe("accesibilidad: pantallas públicas", () => {
  for (const path of PUBLIC_SCREENS) {
    test(`público ${path} sin violaciones serias o críticas`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");
      await expectNoSeriousA11yViolations(page);
    });
  }
});
