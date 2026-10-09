import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { getEmployeeCalendarOptions } from "@/features/employees/use-cases/employee-calendar-options";
import { getSalonBusinessHours } from "@/features/salon/use-cases/salon-business-hours";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { getSalonPaymentMethods } from "@/features/salon/use-cases/salon-payment-methods";
import { utcBounds } from "@/infra/format/dates";
import { getCalendarView } from "./get-calendar-view";

vi.mock("@/features/appointments/data/appointments.repo", () => ({
  findAppointmentsBySalon: vi.fn(async () => []),
}));
vi.mock("@/features/employees/use-cases/employee-calendar-options", () => ({
  getEmployeeCalendarOptions: vi.fn(async () => [{ id: "emp-1", name: "Marta" }]),
}));
vi.mock("@/features/notifications/use-cases/active-message-template", () => ({
  getActiveMessageTemplate: vi.fn(async () => ({ bodyText: "Tu cita fue cancelada." })),
}));
vi.mock("@/features/salon/use-cases/salon-business-hours", () => ({
  getSalonBusinessHours: vi.fn(async () => []),
}));
vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(async () => ({ timezone: "America/Panama" })),
}));
vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  getSalonPaymentMethods: vi.fn(async () => ["cash"]),
}));

const SALON_ID = "00000000-0000-4000-8000-000000000001";
const WEDNESDAY = "2026-05-27";

describe("getCalendarView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("en vista semanal consulta la semana completa y etiqueta el rango visible", async () => {
    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "semanal" });

    expect(model).toMatchObject({
      date: WEDNESDAY,
      view: "semanal",
      showWorkerView: false,
      dateLabel: "25 - 30 de mayo",
    });
    expect(findAppointmentsBySalon).toHaveBeenCalledWith(SALON_ID, {
      startDate: utcBounds("2026-05-25", "2026-05-31", "America/Panama").start,
      endDate: utcBounds("2026-05-25", "2026-05-31", "America/Panama").end,
    });
    expect(getEmployeeCalendarOptions).not.toHaveBeenCalled();
  });

  it("en vista diaria consulta solo el día seleccionado", async () => {
    await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(findAppointmentsBySalon).toHaveBeenCalledWith(SALON_ID, {
      startDate: utcBounds(WEDNESDAY, WEDNESDAY, "America/Panama").start,
      endDate: utcBounds(WEDNESDAY, WEDNESDAY, "America/Panama").end,
    });
  });

  it("degrada la vista por trabajador a semanal cuando el usuario no puede verlo todo", async () => {
    const model = await getCalendarView({
      salonId: SALON_ID,
      canViewAll: false,
      date: WEDNESDAY,
      view: "trabajador",
    });

    expect(model.view).toBe("semanal");
    expect(model.showWorkerView).toBe(false);
    expect(getEmployeeCalendarOptions).not.toHaveBeenCalled();
  });

  it("carga los profesionales para la vista por trabajador cuando puede verlo todo", async () => {
    const model = await getCalendarView({
      salonId: SALON_ID,
      canViewAll: true,
      date: WEDNESDAY,
      view: "trabajador",
    });

    expect(model.view).toBe("trabajador");
    expect(model.showWorkerView).toBe(true);
    expect(getEmployeeCalendarOptions).toHaveBeenCalledWith(SALON_ID);
  });

  it("usa la fecha local del salón a partir de 'now' cuando no se indica fecha", async () => {
    // 2026-05-27T02:00Z es todavía 26 de mayo en Panamá (UTC-5).
    const model = await getCalendarView({
      salonId: SALON_ID,
      canViewAll: false,
      view: "diaria",
      now: new Date("2026-05-27T02:00:00.000Z"),
    });

    expect(model.date).toBe("2026-05-26");
    expect(getSalonIdentity).toHaveBeenCalledWith(SALON_ID);
  });

  it("consulta los métodos de pago y el horario del salón", async () => {
    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY });

    expect(getSalonBusinessHours).toHaveBeenCalledWith(SALON_ID);
    expect(getSalonPaymentMethods).toHaveBeenCalledWith(SALON_ID);
    expect(model.date).toBe(WEDNESDAY);
  });
});
