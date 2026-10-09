import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import {
  findAppointmentCreationResources,
  findAppointmentForCommand,
  findEmployeeExceptionDatesForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
  updateAppointmentWithRpc,
} from "../data/appointment-commands.repo";
import { updateAppointmentSchedule } from "./update-appointment";
import type { AppointmentCommandState } from "../data/appointment-commands.repo";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentCreationResources: vi.fn(),
  findAppointmentForCommand: vi.fn(),
  findEmployeeExceptionDatesForCommand: vi.fn(),
  findEmployeeOccupiedSlotsForCommand: vi.fn(),
  findEmployeeWorkSchedulesForCommand: vi.fn(),
  updateAppointmentWithRpc: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

type DayHours = {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

const appointmentId = "00000000-0000-0000-0000-000000000001";
const salonId = "00000000-0000-0000-0000-000000000002";
const customerId = "00000000-0000-0000-0000-000000000003";
const serviceId = "00000000-0000-0000-0000-000000000004";
const employeeId = "00000000-0000-0000-0000-000000000005";
// 2030-01-01 es martes: día 1 de la semana (0 = lunes).
const startTime = "2030-01-01T10:00:00.000Z";
const input = {
  appointment_id: appointmentId,
  start_time: startTime,
  notes: "",
  assignments: [{ service_id: serviceId, employee_id: employeeId }],
};

const openAllWeek: DayHours[] = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  is_open: true,
  open_time: "00:00",
  close_time: "23:59",
}));

const workAllWeek = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  start_time: "00:00",
  end_time: "23:59",
  is_active: true,
}));

function validAssignment() {
  return {
    service: {
      id: serviceId,
      duration_minutes: 30,
      price: 25,
      salon_id: salonId,
      is_active: true,
      category_id: "category-1",
    },
    employee: {
      id: employeeId,
      salon_id: salonId,
      is_active: true,
      profile_id: null,
      service_ids: [serviceId],
      category_ids: ["category-1"],
    },
  };
}

function validResources(businessHours = openAllWeek) {
  return {
    customerExists: true,
    salonConfig: {
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 30,
      allow_off_hours_bookings: false,
      timezone: "UTC",
    },
    businessHours,
    assignments: [validAssignment()],
  };
}

const scheduledAppointment: AppointmentCommandState = {
  id: appointmentId,
  salon_id: salonId,
  status: "scheduled",
  customer_id: customerId,
};

describe("updateAppointmentSchedule: guardas del caso de uso", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(findAppointmentForCommand).mockResolvedValue(scheduledAppointment);
    vi.mocked(findAppointmentCreationResources).mockResolvedValue(validResources());
    vi.mocked(findEmployeeWorkSchedulesForCommand).mockResolvedValue(workAllWeek);
    vi.mocked(findEmployeeExceptionDatesForCommand).mockResolvedValue([]);
    vi.mocked(findEmployeeOccupiedSlotsForCommand).mockResolvedValue([]);
    vi.mocked(updateAppointmentWithRpc).mockResolvedValue({ ok: true });
  });

  it("no carga ni modifica la cita si no existe en el salón", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue(null);

    const result = await updateAppointmentSchedule(input, { salonId });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/Cita no encontrada/);
    expect(updateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve error y registra si falla la carga de la cita", async () => {
    const failure = new Error("network");
    vi.mocked(findAppointmentForCommand).mockRejectedValue(failure);

    expect(await updateAppointmentSchedule(input, { salonId })).toEqual({
      ok: false,
      error: "No se pudo cargar la cita.",
    });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "update" });
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "no permite editar una cita cerrada (%s)",
    async (status) => {
      vi.mocked(findAppointmentForCommand).mockResolvedValue({ ...scheduledAppointment, status });

      const result = await updateAppointmentSchedule(input, { salonId });

      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.error).toMatch(/cerrada/);
      expect(updateAppointmentWithRpc).not.toHaveBeenCalled();
    }
  );

  it("rechaza una cita sin cliente válido", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue({ ...scheduledAppointment, customer_id: null });

    const result = await updateAppointmentSchedule(input, { salonId });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/cliente/);
    expect(updateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve error de datos si falla la carga de recursos de la cita", async () => {
    const failure = new Error("rpc");
    vi.mocked(findAppointmentCreationResources).mockRejectedValue(failure);

    const result = await updateAppointmentSchedule(input, { salonId });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/Datos inv/);
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "update" });
  });

  it("rechaza mover la cita a un día en que el salón está cerrado", async () => {
    const closedTuesday = openAllWeek.map((day) =>
      day.day_of_week === 1 ? { ...day, is_open: false, open_time: null, close_time: null } : day
    );
    vi.mocked(findAppointmentCreationResources).mockResolvedValue(validResources(closedTuesday));

    expect(await updateAppointmentSchedule(input, { salonId })).toEqual({
      ok: false,
      error: "El salon esta cerrado ese día.",
    });
    expect(updateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve el error del dominio si la cita se reprograma sin servicios", async () => {
    vi.mocked(findAppointmentCreationResources).mockResolvedValue({ ...validResources(), assignments: [] });

    expect(await updateAppointmentSchedule({ ...input, assignments: [] }, { salonId })).toEqual({
      ok: false,
      error: "Selecciona al menos un servicio.",
    });
    expect(updateAppointmentWithRpc).not.toHaveBeenCalled();
  });
});
