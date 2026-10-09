// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buildProfile } from "@/test/action-fixtures";
import { buildWizardProps } from "@/test/ui-appointments-fixtures";
import type { AppointmentWizardData } from "@/features/appointments/view-models";
import NewAppointmentPage from "./page";

const session = vi.hoisted(() => ({ requireProfile: vi.fn() }));
const wizardUseCase = vi.hoisted(() => ({ getAppointmentWizardData: vi.fn() }));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/features/appointments/use-cases/get-appointment-wizard-data", () => wizardUseCase);
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
// El asistente tiene su propia suite: aquí solo se comprueba qué datos recibe.
vi.mock("./appointment-wizard", () => ({
  AppointmentWizard: (props: { customers: unknown[]; services: { name: string }[] }) =>
    createElement(
      "p",
      { "data-testid": "wizard" },
      `wizard:${props.customers.length}:${props.services.map((service) => service.name).join(",")}`
    ),
}));

function wizardData(overrides: Partial<AppointmentWizardData> = {}): AppointmentWizardData {
  return { ...buildWizardProps(), ready: true, ...overrides };
}

describe("NewAppointmentPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    session.requireProfile.mockReset();
    wizardUseCase.getAppointmentWizardData.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega la creación de citas sin el permiso de gestión y no carga datos del asistente", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_VIEW] }));

    mounted = mountComponent(await NewAppointmentPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para crear citas.");
    expect(wizardUseCase.getAppointmentWizardData).not.toHaveBeenCalled();
  });

  it("entrega al asistente los datos del salón del perfil cuando está listo", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] }));
    wizardUseCase.getAppointmentWizardData.mockResolvedValue(wizardData());

    mounted = mountComponent(await NewAppointmentPage());

    expect(wizardUseCase.getAppointmentWizardData).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
    expect(mounted.container.querySelector('[data-testid="wizard"]')?.textContent).toBe(
      "wizard:2:Corte,Tinte,Manicura"
    );
  });

  it("enlaza de vuelta a la agenda y muestra el encabezado de la página", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] }));
    wizardUseCase.getAppointmentWizardData.mockResolvedValue(wizardData());

    mounted = mountComponent(await NewAppointmentPage());

    expect(mounted.container.querySelector("h1")?.textContent).toBe("Nueva cita");
    expect(mounted.container.querySelector<HTMLAnchorElement>('a[href="/appointments"]')?.textContent).toContain(
      "Agenda"
    );
  });

  it("explica qué falta cuando el salón no tiene servicios ni colaboradores", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] }));
    wizardUseCase.getAppointmentWizardData.mockResolvedValue(
      wizardData({ ready: false, services: [], employees: [] })
    );

    mounted = mountComponent(await NewAppointmentPage());

    expect(mounted.container.textContent).toContain(
      "Para agendar necesitas al menos un servicio y un colaborador que lo realice."
    );
    expect(mounted.container.querySelector<HTMLAnchorElement>('a[href="/services"]')?.textContent).toBe(
      "Crear servicio"
    );
    expect(mounted.container.querySelector<HTMLAnchorElement>('a[href="/employees"]')?.textContent).toBe(
      "Crear colaborador"
    );
    expect(mounted.container.querySelector('[data-testid="wizard"]')).toBeNull();
  });

  it("solo pide crear el servicio faltante cuando hay colaboradores", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] }));
    wizardUseCase.getAppointmentWizardData.mockResolvedValue(
      wizardData({ ready: false, services: [], employees: buildWizardProps().employees })
    );

    mounted = mountComponent(await NewAppointmentPage());

    expect(mounted.container.querySelector('a[href="/services"]')).not.toBeNull();
    expect(mounted.container.querySelector('a[href="/employees"]')).toBeNull();
  });
});
