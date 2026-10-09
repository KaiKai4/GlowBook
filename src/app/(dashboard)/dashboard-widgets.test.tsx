// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type {
  PendingAppointmentConfirmation,
  TopService,
} from "@/features/dashboard/use-cases/get-dashboard-overview";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { PendingConfirmations, TopServices } from "./dashboard-widgets";

const pendingAppointment: PendingAppointmentConfirmation = {
  id: "appt-1",
  customerName: "Lucía Pérez",
  phone: "600000000",
  when: "Mañana 10:00",
};

const service: TopService = { name: "Corte", count: 4, pct: 100 };

describe("PendingConfirmations", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el mensaje vacío sin lista ni enlace cuando no hay citas pendientes", () => {
    mounted = mountComponent(<PendingConfirmations pending={[]} />);

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Citas por confirmar");
    expect(mounted.container.textContent).toContain("No hay citas pendientes de confirmar.");
    expect(mounted.container.querySelector("ul")).toBeNull();
    expect(mounted.container.querySelector("a")).toBeNull();
  });

  it("lista cada cita con su estado en texto (Agendada) y enlaza a recordatorios", () => {
    mounted = mountComponent(<PendingConfirmations pending={[pendingAppointment]} />);

    const item = mounted.container.querySelector("li");
    expect(item?.textContent).toContain("Lucía Pérez");
    expect(item?.textContent).toContain("Mañana 10:00");
    expect(item?.textContent).toContain("Agendada");
    expect(mounted.container.querySelector("a")?.getAttribute("href")).toBe("/recordatorios");
  });
});

describe("TopServices", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el mensaje vacío sin gráfica cuando no hay datos", () => {
    mounted = mountComponent(<TopServices services={[]} />);

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Servicios más solicitados");
    expect(mounted.container.textContent).toContain("Aún no hay datos suficientes este mes.");
    expect(mounted.container.querySelector('[role="img"]')).toBeNull();
  });

  it("dibuja la gráfica accesible con el periodo en la cabecera", () => {
    mounted = mountComponent(<TopServices services={[service]} />);

    expect(mounted.container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
      "Servicios más solicitados este mes",
    );
    expect(mounted.container.textContent).toContain("Este mes");
    expect(mounted.container.textContent).toContain("Corte");
  });
});
