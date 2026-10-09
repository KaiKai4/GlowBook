// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
import { PERMISSIONS } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buildProfile, SALON_ID } from "@/test/action-fixtures";
import { buildCalendarAppointment } from "@/test/ui-appointments-fixtures";
import type { CalendarViewModel } from "@/features/appointments/view-models";
import AppointmentsPage from "./page";
import { AppointmentsClient } from "./appointments-client";

const session = vi.hoisted(() => ({ requireProfile: vi.fn() }));
const calendarUseCase = vi.hoisted(() => ({ getCalendarView: vi.fn() }));

vi.mock("@/app/_composition/request-context", () => session);
vi.mock("@/features/appointments/use-cases/get-calendar-view", () => calendarUseCase);
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("@/components/ui/date-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  confirmAppointmentAction: vi.fn(),
  cancelAppointmentAction: vi.fn(),
  completeAppointmentAction: vi.fn(),
}));

const CALENDAR: CalendarViewModel = {
  date: "2026-10-12",
  view: "diaria",
  showWorkerView: true,
  dateLabel: "lunes, 12 de octubre",
  activeCount: 1,
  appointments: [buildCalendarAppointment()],
  timezone: "America/Panama",
  employees: [],
  visibleWeekDates: [],
  businessStart: 8,
  businessEnd: 18,
  salonName: "Salón Prueba",
  cancellationTemplate: "",
  paymentMethodOptions: [],
};

type PageElement = ReactElement<{ initialCalendar?: CalendarViewModel; canManage?: boolean }>;

async function renderPage(searchParams: { date?: string; view?: string } = {}): Promise<PageElement> {
  return (await AppointmentsPage({ searchParams: Promise.resolve(searchParams) })) as PageElement;
}

describe("AppointmentsPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    calendarUseCase.getCalendarView.mockReset();
    calendarUseCase.getCalendarView.mockResolvedValue(CALENDAR);
    session.requireProfile.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega la agenda sin el permiso de ver citas y no consulta el calendario", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [] }));

    const element = await renderPage();
    mounted = mountComponent(element);

    expect(mounted.container.textContent).toContain("No tienes permiso para ver las citas.");
    expect(calendarUseCase.getCalendarView).not.toHaveBeenCalled();
  });

  it("solo ve sus propias citas con permiso de ver pero sin permiso de ver todas", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_VIEW] }));

    const element = await renderPage({ date: "2026-10-12", view: "diaria" });

    expect(calendarUseCase.getCalendarView).toHaveBeenCalledWith({
      salonId: SALON_ID,
      canViewAll: false,
      date: "2026-10-12",
      view: "diaria",
    });
    expect(element.type).toBe(AppointmentsClient);
    expect(element.props.canManage).toBe(false);
    expect(element.props.initialCalendar).toBe(CALENDAR);
  });

  it("permite gestionar citas a quien tiene el permiso de gestión aunque no tenga el de ver", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] }));

    const element = await renderPage();

    expect(element.props.canManage).toBe(true);
    expect(calendarUseCase.getCalendarView).toHaveBeenCalledWith({
      salonId: SALON_ID,
      canViewAll: false,
      date: undefined,
      view: undefined,
    });
  });

  it("muestra la agenda completa al dueño del salón aunque no tenga permiso explícito", async () => {
    session.requireProfile.mockResolvedValue(buildProfile({ isOwner: true, permissions: [] }));

    await renderPage();

    expect(calendarUseCase.getCalendarView).toHaveBeenCalledWith(expect.objectContaining({ canViewAll: true }));
  });

  it("muestra todas las citas del salón con el permiso de ver todas", async () => {
    session.requireProfile.mockResolvedValue(
      buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_VIEW_ALL] })
    );

    await renderPage();

    expect(calendarUseCase.getCalendarView).toHaveBeenCalledWith(expect.objectContaining({ canViewAll: true }));
  });
});
