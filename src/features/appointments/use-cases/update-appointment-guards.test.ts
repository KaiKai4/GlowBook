import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { updateAppointmentSchedule } from "./update-appointment";
import type { AppointmentCommandState } from "../data/appointment-commands.repo";
import { createAppointmentCommandFakes, updateDepsFrom } from "@/test/appointment-command-fakes";

const fakes = createAppointmentCommandFakes();
const runUpdate: typeof updateAppointmentSchedule = (input, ctx) => updateAppointmentSchedule(input, ctx, updateDepsFrom(fakes));

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

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
const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";
const input = {
  appointment_id: appointmentId,
  start_time: startTime,
  notes: "",
  assignments: [{ service_id: serviceId, employee_id: employeeId }],
  idempotency_key: idempotencyKey,
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
    fakes.findAppointmentForCommand.mockResolvedValue(scheduledAppointment);
    fakes.findAppointmentCreationResources.mockResolvedValue(validResources());
    fakes.findWorkSchedulesByEmployeeForCommand.mockResolvedValue(new Map([[employeeId, workAllWeek]]));
    fakes.findExceptionDatesByEmployeeForCommand.mockResolvedValue(new Map());
    fakes.findOccupiedSlotsByEmployeeForCommand.mockResolvedValue(new Map());
    fakes.updateAppointmentWithRpc.mockResolvedValue({ ok: true });
  });

  it("no carga ni modifica la cita si no existe en el salón", async () => {
    fakes.findAppointmentForCommand.mockResolvedValue(null);

    const result = await runUpdate(input, { salonId, idempotencyKey });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/Cita no encontrada/);
    expect(fakes.updateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve error y registra si falla la carga de la cita", async () => {
    const failure = new Error("network");
    fakes.findAppointmentForCommand.mockRejectedValue(failure);

    expect(await runUpdate(input, { salonId, idempotencyKey })).toEqual({
      ok: false,
      error: "No se pudo cargar la cita.",
    });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "update" });
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "no permite editar una cita cerrada (%s)",
    async (status) => {
      fakes.findAppointmentForCommand.mockResolvedValue({ ...scheduledAppointment, status });

      const result = await runUpdate(input, { salonId, idempotencyKey });

      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.error).toMatch(/cerrada/);
      expect(fakes.updateAppointmentWithRpc).not.toHaveBeenCalled();
    }
  );

  it("rechaza una cita sin cliente válido", async () => {
    fakes.findAppointmentForCommand.mockResolvedValue({ ...scheduledAppointment, customer_id: null });

    const result = await runUpdate(input, { salonId, idempotencyKey });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/cliente/);
    expect(fakes.updateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve error de datos si falla la carga de recursos de la cita", async () => {
    const failure = new Error("rpc");
    fakes.findAppointmentCreationResources.mockRejectedValue(failure);

    const result = await runUpdate(input, { salonId, idempotencyKey });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/Datos inv/);
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "update" });
  });

  it("rechaza mover la cita a un día en que el salón está cerrado", async () => {
    const closedTuesday = openAllWeek.map((day) =>
      day.day_of_week === 1 ? { ...day, is_open: false, open_time: null, close_time: null } : day
    );
    fakes.findAppointmentCreationResources.mockResolvedValue(validResources(closedTuesday));

    expect(await runUpdate(input, { salonId, idempotencyKey })).toEqual({
      ok: false,
      error: "El salón está cerrado ese día.",
    });
    expect(fakes.updateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve el error del dominio si la cita se reprograma sin servicios", async () => {
    fakes.findAppointmentCreationResources.mockResolvedValue({ ...validResources(), assignments: [] });

    expect(await runUpdate({ ...input, assignments: [] }, { salonId, idempotencyKey })).toEqual({
      ok: false,
      error: "Selecciona al menos un servicio.",
    });
    expect(fakes.updateAppointmentWithRpc).not.toHaveBeenCalled();
  });
});
