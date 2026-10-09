// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import type { CalendarViewModel } from "@/features/appointments/view-models";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buildCalendarAppointment,
  buildEmployees,
  PAYMENT_OPTIONS,
  SALON_TZ,
} from "@/test/ui-appointments-fixtures";
import { buttonWithText, byAriaLabel, click } from "@/test/ui-appointments-dom";
import { AppointmentsClient } from "./appointments-client";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/components/ui/date-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  confirmAppointmentAction: vi.fn(),
  cancelAppointmentAction: vi.fn(),
  completeAppointmentAction: vi.fn(),
}));

function buildCalendar(overrides: Partial<CalendarViewModel> = {}): CalendarViewModel {
  return {
    date: "2026-10-12",
    view: "diaria",
    showWorkerView: true,
    dateLabel: "lunes, 12 de octubre",
    activeCount: 1,
    appointments: [buildCalendarAppointment({ id: "appt-1" })],
    timezone: SALON_TZ,
    employees: buildEmployees(),
    visibleWeekDates: [],
    businessStart: 8,
    businessEnd: 18,
    salonName: "Salón Prueba",
    cancellationTemplate: "Hola {cliente}",
    paymentMethodOptions: PAYMENT_OPTIONS,
    ...overrides,
  };
}

describe("AppointmentsClient", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    router.push.mockReset();
    router.replace.mockReset();
    router.refresh.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el título, la fecha y el conteo de citas activas del día", () => {
    mounted = mountComponent(
      <AppointmentsClient initialCalendar={buildCalendar({ activeCount: 3 })} canManage />
    );

    expect(mounted.container.querySelector("h1")?.textContent).toContain("Agenda");
    expect(mounted.container.textContent).toContain("lunes, 12 de octubre");
    expect(mounted.container.textContent).toContain("3 citas activas");
  });

  it("enlaza a la creación de cita solo a quien puede gestionar citas", () => {
    mounted = mountComponent(<AppointmentsClient initialCalendar={buildCalendar()} canManage />);
    const link = mounted.container.querySelector<HTMLAnchorElement>('a[href="/appointments/new"]');
    expect(link?.textContent).toContain("Nueva cita");
    mounted.unmount();
    mounted = null;

    mounted = mountComponent(<AppointmentsClient initialCalendar={buildCalendar()} canManage={false} />);
    expect(mounted.container.querySelector('a[href="/appointments/new"]')).toBeNull();
  });

  it("reemplaza la URL con la fecha y vista elegidas al navegar al día siguiente", () => {
    mounted = mountComponent(<AppointmentsClient initialCalendar={buildCalendar()} canManage />);

    click(byAriaLabel(mounted.container, "Día siguiente"));

    expect(router.replace).toHaveBeenCalledWith("/appointments?date=2026-10-13&view=diaria");
  });

  it("cambia a la vista semanal manteniendo la fecha actual en la URL", () => {
    mounted = mountComponent(<AppointmentsClient initialCalendar={buildCalendar()} canManage />);

    click(buttonWithText(mounted.container, "Semanal"));

    expect(router.replace).toHaveBeenCalledWith("/appointments?date=2026-10-12&view=semanal");
  });

  it("lista en el resumen las citas próximas del día recibido del servidor", () => {
    mounted = mountComponent(<AppointmentsClient initialCalendar={buildCalendar()} canManage />);

    const summary = mounted.container.querySelectorAll("div.divide-y > div");
    expect(summary).toHaveLength(1);
    expect(summary[0]?.textContent).toContain("Ana Pérez");
  });
});
