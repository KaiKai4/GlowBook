import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { createAppointment } from "./create-appointment";
import { createAppointmentCommandFakes, createDepsFrom } from "@/test/appointment-command-fakes";

const fakes = createAppointmentCommandFakes();
const runCreate: typeof createAppointment = (input, ctx) => createAppointment(input, ctx, createDepsFrom(fakes));

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

type DayHours = {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

const salonId = "00000000-0000-0000-0000-000000000001";
const userId = "00000000-0000-0000-0000-000000000002";
const customerId = "00000000-0000-0000-0000-000000000003";
const serviceId = "00000000-0000-0000-0000-000000000004";
const employeeId = "00000000-0000-0000-0000-000000000005";
// 2030-01-01 es martes: día 1 de la semana (0 = lunes).
const startTime = "2030-01-01T10:00:00.000Z";
const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";
const input = {
  customer_id: customerId,
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

function validResources(overrides: { businessHours?: typeof openAllWeek } = {}) {
  return {
    customerExists: true,
    salonConfig: {
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 30,
      allow_off_hours_bookings: false,
      timezone: "UTC",
    },
    businessHours: overrides.businessHours ?? openAllWeek,
    assignments: [validAssignment()],
  };
}

describe("createAppointment: guardas del caso de uso", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fakes.findAppointmentCreationResources.mockResolvedValue(validResources());
    fakes.findWorkSchedulesByEmployeeForCommand.mockResolvedValue(new Map([[employeeId, workAllWeek]]));
    fakes.findExceptionDatesByEmployeeForCommand.mockResolvedValue(new Map());
    fakes.findOccupiedSlotsByEmployeeForCommand.mockResolvedValue(new Map());
    fakes.createAppointmentWithRpc.mockResolvedValue({ ok: true, appointmentId: "appointment-1" });
  });

  it("rechaza si el cliente no pertenece al salón", async () => {
    fakes.findAppointmentCreationResources.mockResolvedValue({
      ...validResources(),
      customerExists: false,
    });

    expect(await runCreate(input, { salonId, userId, idempotencyKey })).toEqual({
      ok: false,
      error: "Cliente no encontrado en este salón.",
    });
    expect(fakes.createAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("rechaza si el salón no tiene configuración", async () => {
    fakes.findAppointmentCreationResources.mockResolvedValue({
      ...validResources(),
      salonConfig: null,
    });

    expect(await runCreate(input, { salonId, userId, idempotencyKey })).toEqual({
      ok: false,
      error: "Salón no encontrado.",
    });
  });

  it("rechaza si algún servicio o profesional no existe en el salón", async () => {
    fakes.findAppointmentCreationResources.mockResolvedValue({
      ...validResources(),
      assignments: [{ ...validAssignment(), employee: null }],
    });

    expect(await runCreate(input, { salonId, userId, idempotencyKey })).toEqual({
      ok: false,
      error: "Servicio o profesional no encontrado en el salón.",
    });
  });

  it("devuelve 'Datos inválidos.' y registra el error si falla la carga de recursos", async () => {
    const failure = new Error("db down");
    fakes.findAppointmentCreationResources.mockRejectedValue(failure);

    expect(await runCreate(input, { salonId, userId, idempotencyKey })).toEqual({
      ok: false,
      error: "Datos inválidos.",
    });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
  });

  it("devuelve error de disponibilidad si falla consultar la agenda del profesional", async () => {
    const failure = new Error("timeout");
    fakes.findWorkSchedulesByEmployeeForCommand.mockRejectedValue(failure);

    expect(await runCreate(input, { salonId, userId, idempotencyKey })).toEqual({
      ok: false,
      error: "No se pudo validar la disponibilidad del profesional.",
    });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
    expect(fakes.createAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("rechaza una cita en un día en que el salón está cerrado sin llamar al RPC", async () => {
    const closedTuesday = openAllWeek.map((day) =>
      day.day_of_week === 1 ? { ...day, is_open: false, open_time: null, close_time: null } : day
    );
    fakes.findAppointmentCreationResources.mockResolvedValue(
      validResources({ businessHours: closedTuesday })
    );

    expect(await runCreate(input, { salonId, userId, idempotencyKey })).toEqual({
      ok: false,
      error: "El salón está cerrado ese día.",
    });
    expect(fakes.createAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve el error del dominio si la cita no tiene servicios", async () => {
    // El schema exige al menos un servicio; una llamada directa llega aquí
    // y el dominio lo rechaza antes de calcular el fin.
    fakes.findAppointmentCreationResources.mockResolvedValue({ ...validResources(), assignments: [] });

    expect(await runCreate({ ...input, assignments: [] }, { salonId, userId, idempotencyKey })).toEqual({
      ok: false,
      error: "Selecciona al menos un servicio.",
    });
    expect(fakes.createAppointmentWithRpc).not.toHaveBeenCalled();
  });
});
