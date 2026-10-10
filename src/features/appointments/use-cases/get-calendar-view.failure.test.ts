import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { getCalendarView } from "./get-calendar-view";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

vi.mock("@/features/appointments/data/appointments.repo", () => ({
  findAppointmentsBySalon: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-calendar-options", () => ({
  getEmployeeCalendarOptions: vi.fn(async () => []),
}));
vi.mock("@/features/notifications/use-cases/active-message-template", () => ({
  getActiveMessageTemplate: vi.fn(async () => ({ bodyText: "" })),
}));
vi.mock("@/features/salon/use-cases/salon-business-hours", () => ({
  getSalonBusinessHours: vi.fn(async () => []),
}));
vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(async () => ({ timezone: "America/Panama" })),
}));
vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  getSalonPaymentMethods: vi.fn(async () => ({ options: [] })),
}));

const FALLBACK = "No se pudo cargar el calendario de citas.";
const SALON_ID = "00000000-0000-4000-8000-000000000001";

describe("getCalendarView: fallo tecnico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve el mensaje fijo y registra el error con el contexto del caso de uso", async () => {
    const technical = new Error("connection reset by peer");
    vi.mocked(findAppointmentsBySalon).mockRejectedValue(technical);

    const result = await getCalendarView({
      salonId: SALON_ID,
      canViewAll: false,
      date: "2026-05-27",
      view: "diaria",
    });

    expect(result).toEqual({ ok: false, error: FALLBACK });
    expect(captureError).toHaveBeenCalledWith(technical, {
      module: "appointments",
      action: "calendar-view",
    });
  });
});
