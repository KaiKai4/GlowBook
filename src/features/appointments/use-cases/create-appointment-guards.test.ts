import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import {
  createAppointmentWithRpc,
  findAppointmentCreationResources,
  findEmployeeExceptionDatesForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
} from "../data/appointment-commands.repo";
import { createAppointment } from "./create-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  createAppointmentWithRpc: vi.fn(),
  findAppointmentCreationResources: vi.fn(),
  findEmployeeOccupiedSlotsForCommand: vi.fn(),
  findEmployeeExceptionDatesForCommand: vi.fn(),
  findEmployeeWorkSchedulesForCommand: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

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
const input = {
  customer_id: customerId,
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
    vi.mocked(findAppointmentCreationResources).mockResolvedValue(validResources());
    vi.mocked(findEmployeeWorkSchedulesForCommand).mockResolvedValue(workAllWeek);
    vi.mocked(findEmployeeExceptionDatesForCommand).mockResolvedValue([]);
    vi.mocked(findEmployeeOccupiedSlotsForCommand).mockResolvedValue([]);
    vi.mocked(createAppointmentWithRpc).mockResolvedValue({ ok: true, appointmentId: "appointment-1" });
  });

  it("rechaza si el cliente no pertenece al salón", async () => {
    vi.mocked(findAppointmentCreationResources).mockResolvedValue({
      ...validResources(),
      customerExists: false,
    });

    expect(await createAppointment(input, { salonId, userId })).toEqual({
      ok: false,
      error: "Cliente no encontrado en este salón.",
    });
    expect(createAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("rechaza si el salón no tiene configuración", async () => {
    vi.mocked(findAppointmentCreationResources).mockResolvedValue({
      ...validResources(),
      salonConfig: null,
    });

    expect(await createAppointment(input, { salonId, userId })).toEqual({
      ok: false,
      error: "Salón no encontrado.",
    });
  });

  it("rechaza si algún servicio o profesional no existe en el salón", async () => {
    vi.mocked(findAppointmentCreationResources).mockResolvedValue({
      ...validResources(),
      assignments: [{ ...validAssignment(), employee: null }],
    });

    expect(await createAppointment(input, { salonId, userId })).toEqual({
      ok: false,
      error: "Servicio o profesional no encontrado en el salón.",
    });
  });

  it("devuelve 'Datos inválidos.' y registra el error si falla la carga de recursos", async () => {
    const failure = new Error("db down");
    vi.mocked(findAppointmentCreationResources).mockRejectedValue(failure);

    expect(await createAppointment(input, { salonId, userId })).toEqual({
      ok: false,
      error: "Datos inválidos.",
    });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
  });

  it("devuelve error de disponibilidad si falla consultar la agenda del profesional", async () => {
    const failure = new Error("timeout");
    vi.mocked(findEmployeeWorkSchedulesForCommand).mockRejectedValue(failure);

    expect(await createAppointment(input, { salonId, userId })).toEqual({
      ok: false,
      error: "No se pudo validar la disponibilidad del profesional.",
    });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
    expect(createAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("rechaza una cita en un día en que el salón está cerrado sin llamar al RPC", async () => {
    const closedTuesday = openAllWeek.map((day) =>
      day.day_of_week === 1 ? { ...day, is_open: false, open_time: null, close_time: null } : day
    );
    vi.mocked(findAppointmentCreationResources).mockResolvedValue(
      validResources({ businessHours: closedTuesday })
    );

    expect(await createAppointment(input, { salonId, userId })).toEqual({
      ok: false,
      error: "El salon esta cerrado ese día.",
    });
    expect(createAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("devuelve el error del dominio si la cita no tiene servicios", async () => {
    // El schema exige al menos un servicio; una llamada directa llega aquí
    // y el dominio lo rechaza antes de calcular el fin.
    vi.mocked(findAppointmentCreationResources).mockResolvedValue({ ...validResources(), assignments: [] });

    expect(await createAppointment({ ...input, assignments: [] }, { salonId, userId })).toEqual({
      ok: false,
      error: "Selecciona al menos un servicio.",
    });
    expect(createAppointmentWithRpc).not.toHaveBeenCalled();
  });
});
