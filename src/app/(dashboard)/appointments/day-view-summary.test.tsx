// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import type { CalendarAppointment } from "@/features/appointments/view-models";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buildCalendarAppointment, SALON_TZ } from "@/test/ui-appointments-fixtures";
import { buttonWithText, byAriaLabel, click } from "@/test/ui-appointments-dom";
import { AppointmentsSummary } from "./day-view-summary";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

function upcomingAppointments(count: number): CalendarAppointment[] {
  return Array.from({ length: count }, (_, index) =>
    buildCalendarAppointment({
      id: `appt-${String(index).padStart(2, "0")}`,
      start_time: `2026-10-12T${String(8 + index).padStart(2, "0")}:00:00-05:00`,
      end_time: `2026-10-12T${String(8 + index).padStart(2, "0")}:30:00-05:00`,
    })
  );
}

function bodyRows(container: HTMLElement): HTMLTableRowElement[] {
  return Array.from(
    container.querySelectorAll<HTMLTableRowElement>('table[aria-label="Resumen de citas"] tbody tr')
  ).filter((row) => !row.querySelector("td[colspan]"));
}

function renderSummary(
  appointments: CalendarAppointment[],
  overrides: Partial<Parameters<typeof AppointmentsSummary>[0]> = {}
) {
  return mountComponent(
    <AppointmentsSummary
      appointments={appointments}
      tz={SALON_TZ}
      canManage
      onComplete={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />
  );
}

describe("AppointmentsSummary (tabla del resumen)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("página el resumen de 10 en 10 y avanza a la página siguiente", () => {
    mounted = renderSummary(upcomingAppointments(12));

    expect(bodyRows(mounted.container)).toHaveLength(10);
    expect(mounted.container.textContent).toContain("Página 1 de 2");

    click(byAriaLabel(mounted.container, "Página siguiente"));

    expect(bodyRows(mounted.container)).toHaveLength(2);
    expect(mounted.container.textContent).toContain("Página 2 de 2");
  });

  it("vuelve a la página 1 al cambiar de pestaña del resumen", () => {
    mounted = renderSummary([
      ...upcomingAppointments(12),
      buildCalendarAppointment({ id: "done", status: "completed" }),
    ]);
    click(byAriaLabel(mounted.container, "Página siguiente"));
    expect(mounted.container.textContent).toContain("Página 2 de 2");

    click(buttonWithText(mounted.container, "Completadas"));
    expect(bodyRows(mounted.container)).toHaveLength(1);

    click(buttonWithText(mounted.container, "Citas próximas"));
    expect(bodyRows(mounted.container)).toHaveLength(10);
    expect(mounted.container.textContent).toContain("Página 1 de 2");
  });

  it("llama a completar con la cita de la fila", () => {
    const onComplete = vi.fn();
    const appointment = buildCalendarAppointment({ id: "appt-1" });
    mounted = renderSummary([appointment], { onComplete });

    click(buttonWithText(mounted.container, "Completar"));

    expect(onComplete).toHaveBeenCalledWith(appointment);
  });

  it("cancela desde el menú de acciones y lo cierra", () => {
    const onCancel = vi.fn();
    const appointment = buildCalendarAppointment({ id: "appt-1" });
    mounted = renderSummary([appointment], { onCancel });

    const toggle = byAriaLabel(mounted.container, "Abrir acciones de cita");
    click(toggle);
    click(buttonWithText(mounted.container, "Cancelar"));

    expect(onCancel).toHaveBeenCalledWith(appointment);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("no muestra acciones de gestión sin permiso y conserva el estado como insignia de texto", () => {
    mounted = renderSummary([buildCalendarAppointment({ id: "appt-1" })], { canManage: false });

    expect(mounted.container.querySelector('button[aria-label="Abrir acciones de cita"]')).toBeNull();
    expect(bodyRows(mounted.container)[0]?.textContent).toContain("Agendada");
  });
});
