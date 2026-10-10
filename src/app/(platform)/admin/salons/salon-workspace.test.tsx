// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, getButtonByText } from "@/test/ui-admin-dom";
import { CATALOG_MODULES, makeDetail, makeLimit, makeRow } from "@/test/ui-admin-fixtures";
import { SalonWorkspace } from "./salon-workspace";
import type { SalonWorkspaceSalon } from "./salon-workspace-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) =>
      React.createElement("a", { href, className }, children),
  };
});
vi.mock("./actions", () => ({
  deleteSalonAction: vi.fn(),
  updateSalonStatusAction: vi.fn(),
}));
vi.mock("../subscriptions/actions", () => ({
  resolveAlertAction: vi.fn(),
  assignPlanAction: vi.fn(),
  registerPaymentAction: vi.fn(),
  giveAddonAction: vi.fn(),
  giveManualExtraAction: vi.fn(),
  cancelExtraAction: vi.fn(),
}));

const SALON: SalonWorkspaceSalon = {
  id: "salon-1",
  name: "Salón Luna",
  contactEmail: "hola@luna.test",
  phone: "+507 6000-0000",
  isActive: true,
  createdAtLabel: "1 sep 2026",
  ownerNames: ["Ana Pérez"],
  customerCount: 12,
  collaboratorCount: 3,
  appointmentCount: 48,
  serviceCount: 7,
};

function renderWorkspace(
  overrides: { salon?: Partial<SalonWorkspaceSalon>; row?: Parameters<typeof makeRow>[0] | null; detail?: Parameters<typeof makeDetail>[0] } = {}
): MountedComponent {
  const row = overrides.row === null ? null : makeRow(overrides.row ?? {});
  return mountComponent(
    <SalonWorkspace
      salon={{ ...SALON, ...overrides.salon }}
      row={row}
      detail={makeDetail(overrides.detail ?? {})}
      modules={CATALOG_MODULES}
    />
  );
}

function clickTab(container: HTMLElement, label: string): void {
  clickElement(getButtonByText(container, label));
}

describe("SalonWorkspace", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el nombre del salón y su estado activo en la cabecera", () => {
    mounted = renderWorkspace();

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Salón Luna");
    expect(mounted.container.textContent).toContain("Activo");
    expect(mounted.container.textContent).toContain("Pro · Activo · USD 30.00/mes");
  });

  it("indica suspendido y sin plan cuando el salón está inactivo y no tiene fila de suscripción", () => {
    mounted = renderWorkspace({ salon: { isActive: false }, row: null, detail: { plan: null, assignment: null, limits: [], enabledModules: [] } });

    expect(mounted.container.textContent).toContain("Suspendido");
    expect(mounted.container.textContent).toContain("Sin plan asignado");
  });

  it("muestra las métricas de uso del salón en el resumen", () => {
    mounted = renderWorkspace();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Clientes");
    expect(text).toContain("12");
    expect(text).toContain("Colaboradores");
    expect(text).toContain("Citas");
    expect(text).toContain("48");
    expect(text).toContain("Servicios");
    expect(text).toContain("7");
  });

  it("muestra los datos de contacto registrados y el ID del salón", () => {
    mounted = renderWorkspace();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("hola@luna.test");
    expect(text).toContain("+507 6000-0000");
    expect(text).toContain("1 sep 2026");
    expect(text).toContain("salon-1");
  });

  it("usa textos de respaldo cuando faltan correo, teléfono u owner", () => {
    mounted = renderWorkspace({ salon: { contactEmail: "", phone: "", ownerNames: [] } });

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Sin correo registrado");
    expect(text).toContain("Sin teléfono");
    expect(text).toContain("Sin owner");
  });

  it("lista a los owners del salón", () => {
    mounted = renderWorkspace({ salon: { ownerNames: ["Ana Pérez", "Luis Soto"] } });

    const owners = Array.from(mounted.container.querySelectorAll("ul li")).map((li) => li.textContent);
    expect(owners).toEqual(["Ana Pérez", "Luis Soto"]);
  });

  it("enlaza la gestión de suscripción con el salón seleccionado", () => {
    mounted = renderWorkspace();

    const link = mounted.container.querySelector<HTMLAnchorElement>('a[href="/admin/subscriptions?salon=salon-1"]');
    expect(link?.textContent).toContain("Gestionar suscripcion y extras");
  });

  it("muestra la fecha pagada hasta cuando el periodo está vigente", () => {
    mounted = renderWorkspace();

    expect(mounted.container.textContent).toContain("Pagado hasta");
  });

  it("muestra el fin del trial cuando el salón aún no tiene periodo pagado", () => {
    mounted = renderWorkspace({
      detail: {
        assignment: {
          planId: "plan-pro",
          status: "trialing",
          startsAt: "2026-10-01",
          endsAt: null,
          trialEndsAt: "2026-10-15",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          notes: "",
        },
      },
    });

    expect(mounted.container.textContent).toContain("Trial hasta");
  });

  it("cuenta los límites con alerta en la pestaña Plan y uso", () => {
    mounted = renderWorkspace({
      detail: {
        limits: [
          makeLimit({ warningLevel: "near_limit", message: "Cerca" }),
          makeLimit({ warningLevel: "none" }),
        ],
      },
    });

    const usageTab = getButtonByText(mounted.container, "Plan y uso");
    expect(usageTab.textContent).toContain("1");
  });

  it("en la pestaña Plan y uso muestra el consumo y enlaza a la gestión de planes", () => {
    mounted = renderWorkspace();

    clickTab(mounted.container, "Plan y uso");

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Consumo de límites");
    expect(text).toContain("Total mensual");
    const link = mounted.container.querySelector<HTMLAnchorElement>('a[href="/admin/subscriptions?salon=salon-1"]');
    expect(link?.textContent).toContain("Cambiar plan, registrar pago o dar extras");
  });

  it("invita a asignar un plan cuando el salón no tiene fila de suscripción", () => {
    mounted = renderWorkspace({ row: null, detail: { plan: null, assignment: null, limits: [], enabledModules: [] } });

    clickTab(mounted.container, "Plan y uso");

    expect(mounted.container.textContent).toContain("Asignar un plan a este salon");
    expect(mounted.container.textContent).toContain("Asigna un plan para ver el consumo de límites");
  });

  it("en la pestaña Acciones ofrece suspender el salón y la zona de peligro", () => {
    mounted = renderWorkspace();

    clickTab(mounted.container, "Acciones");

    expect(mounted.container.textContent).toContain("Estado del salon");
    expect(mounted.container.textContent).toContain("Zona de peligro");
    expect(getButtonByText(mounted.container, "Suspender").textContent).toContain("Suspender");
    expect(getButtonByText(mounted.container, "Eliminar").textContent).toContain("Eliminar");
  });

  it("vuelve al resumen al seleccionar de nuevo la pestaña Resumen", () => {
    mounted = renderWorkspace();

    clickTab(mounted.container, "Acciones");
    expect(mounted.container.textContent).toContain("Zona de peligro");

    clickTab(mounted.container, "Resumen");
    expect(mounted.container.textContent).not.toContain("Zona de peligro");
    expect(mounted.container.textContent).toContain("Datos de contacto");
  });
});
