import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import {
  findAppointmentCreationResources,
  findAppointmentForCommand,
  findEmployeeExceptionDatesForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
  updateAppointmentWithRpc,
  type AppointmentCommandState,
  type AppointmentCreationResources,
} from "../data/appointment-commands.repo";
import type { UpdateAppointmentScheduleInput } from "../schemas";
import { updateAppointmentSchedule } from "./update-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentCreationResources: vi.fn(),
  findAppointmentForCommand: vi.fn(),
  findEmployeeExceptionDatesForCommand: vi.fn(),
  findEmployeeOccupiedSlotsForCommand: vi.fn(),
  findEmployeeWorkSchedulesForCommand: vi.fn(),
  updateAppointmentWithRpc: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const salonId = "00000000-0000-4000-8000-0000000000g1";
const appointmentId = "00000000-0000-4000-8000-0000000000g2";
const customerId = "00000000-0000-4000-8000-0000000000g3";
const categoryId = "00000000-0000-4000-8000-0000000000g4";
const serviceId = "00000000-0000-4000-8000-0000000000g5";
const employeeId = "00000000-0000-4000-8000-0000000000g6";

// 2030-01-01 es martes. 09:00 en Panamá son las 14:00 UTC.
const startIso = "2030-01-01T14:00:00.000Z";

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedResources = vi.mocked(findAppointmentCreationResources);
const mockedSchedules = vi.mocked(findEmployeeWorkSchedulesForCommand);
const mockedExceptions = vi.mocked(findEmployeeExceptionDatesForCommand);
const mockedOccupied = vi.mocked(findEmployeeOccupiedSlotsForCommand);
const mockedRpc = vi.mocked(updateAppointmentWithRpc);
const mockedCaptureError = vi.mocked(captureError);

function state(overrides: Partial<AppointmentCommandState> = {}): AppointmentCommandState {
  return {
    id: appointmentId,
    salon_id: salonId,
    status: "scheduled",
    customer_id: customerId,
    ...overrides,
  };
}

function resources(overrides: Partial<AppointmentCreationResources> = {}): AppointmentCreationResources {
  return {
    customerExists: true,
    salonConfig: {
      timezone: "America/Panama",
      allow_off_hours_bookings: false,
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 15,
    },
    businessHours: [{ day_of_week: 1, is_open: true, open_time: "08:00", close_time: "18:00" }],
    assignments: [
      {
        service: {
          id: serviceId,
          duration_minutes: 30,
          price: 25,
          salon_id: salonId,
          is_active: true,
          category_id: categoryId,
        },
        employee: {
          id: employeeId,
          salon_id: salonId,
          is_active: true,
          profile_id: null,
          service_ids: [serviceId],
          category_ids: [categoryId],
        },
      },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<UpdateAppointmentScheduleInput> = {}): UpdateAppointmentScheduleInput {
  return {
    appointment_id: appointmentId,
    start_time: startIso,
    notes: "Reprogramada por el cliente",
    assignments: [{ service_id: serviceId, employee_id: employeeId }],
    ...overrides,
  };
}

const deps = { salonId };

describe("updateAppointmentSchedule: estado de la cita", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(state());
    mockedResources.mockResolvedValue(resources());
    mockedSchedules.mockResolvedValue([
      { day_of_week: 1, is_active: true, start_time: "08:00", end_time: "18:00" },
    ]);
    mockedExceptions.mockResolvedValue([]);
    mockedOccupied.mockResolvedValue([]);
    mockedRpc.mockResolvedValue({ ok: true });
  });

  it("reescribe los ítems con la cita excluida de su propia agenda", async () => {
    const result = await updateAppointmentSchedule(input(), deps);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedFind).toHaveBeenCalledWith(appointmentId, salonId);
    expect(mockedResources).toHaveBeenCalledWith({
      salonId,
      customerId,
      assignments: [{ service_id: serviceId, employee_id: employeeId }],
    });
    expect(mockedOccupied).toHaveBeenCalledWith({
      salonId,
      employeeId,
      date: new Date(startIso),
      timezone: "America/Panama",
      excludeAppointmentId: appointmentId,
    });
    expect(mockedRpc).toHaveBeenCalledWith({
      appointment_id: appointmentId,
      notes: "Reprogramada por el cliente",
      items: [
        {
          salon_id: salonId,
          service_id: serviceId,
          employee_id: employeeId,
          start_time: startIso,
          end_time: "2030-01-01T14:30:00.000Z",
          duration_minutes: 30,
          price: 25,
          ordering: 1,
          blocks_calendar: true,
        },
      ],
    });
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "no edita una cita en estado %s",
    async (status) => {
      mockedFind.mockResolvedValue(state({ status }));

      expect(await updateAppointmentSchedule(input(), deps)).toEqual({
        ok: false,
        // CONDUCTA ACTUAL (posible bug): el mensaje se guarda con codificación doble
        // (mojibake) en use-cases/update-appointment.ts; aquí se fija el texto actual.
        error: "Esta cita ya está cerrada y no se puede editar.",
      });
      expect(mockedResources).not.toHaveBeenCalled();
      expect(mockedRpc).not.toHaveBeenCalled();
    }
  );

  it("rechaza una cita que no existe en el salón sin cargar recursos", async () => {
    mockedFind.mockResolvedValue(null);

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      // CONDUCTA ACTUAL (posible bug): mojibake en el mensaje de "no encontrada".
      error: "Cita no encontrada en este salón.",
    });
    expect(mockedResources).not.toHaveBeenCalled();
  });

  it("devuelve error y registra si falla cargar la cita", async () => {
    const failure = new Error("read failed");
    mockedFind.mockRejectedValue(failure);

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "No se pudo cargar la cita.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "update",
    });
  });

  it("rechaza si el cliente de la cita ya no existe en el salón", async () => {
    mockedResources.mockResolvedValue(resources({ customerExists: false }));

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      // CONDUCTA ACTUAL (posible bug): mojibake en el mensaje de cliente no encontrado.
      error: "Cliente no encontrado en este salón.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("rechaza si el salón no tiene configuración de agenda", async () => {
    mockedResources.mockResolvedValue(resources({ salonConfig: null }));

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      // CONDUCTA ACTUAL (posible bug): mojibake en el mensaje de salón no encontrado.
      error: "Salón no encontrado.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});

describe("updateAppointmentSchedule: disponibilidad y errores del RPC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(state());
    mockedResources.mockResolvedValue(resources());
    mockedSchedules.mockResolvedValue([
      { day_of_week: 1, is_active: true, start_time: "08:00", end_time: "18:00" },
    ]);
    mockedExceptions.mockResolvedValue([]);
    mockedOccupied.mockResolvedValue([]);
    mockedRpc.mockResolvedValue({ ok: true });
  });

  it("si falla consultar la agenda devuelve error de disponibilidad y registra el fallo", async () => {
    const failure = new Error("occupied failed");
    mockedOccupied.mockRejectedValue(failure);

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "No se pudo validar la disponibilidad del profesional.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "update",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("si falla consultar los turnos del profesional devuelve el mismo error de disponibilidad", async () => {
    mockedSchedules.mockRejectedValue(new Error("schedules failed"));

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "No se pudo validar la disponibilidad del profesional.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("si la agenda ya está ocupada en ese horario devuelve el error de dominio y no escribe", async () => {
    mockedOccupied.mockResolvedValue([
      { start_time: "2030-01-01T14:10:00.000Z", end_time: "2030-01-01T14:20:00.000Z" },
    ]);

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "El profesional ya tiene una cita en ese horario.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("rechaza mover la cita a un día libre puntual del profesional", async () => {
    mockedExceptions.mockResolvedValue(["2030-01-01"]);

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "El profesional tiene el día libre en esa fecha.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("rechaza un profesional que no atiende la categoría del servicio", async () => {
    const base = resources();
    const [first] = base.assignments;
    if (!first?.service) throw new Error("fixture sin servicio");
    mockedResources.mockResolvedValue(
      resources({
        assignments: [
          {
            service: first.service,
            employee: { ...first.employee, id: employeeId, salon_id: salonId, is_active: true, profile_id: null, service_ids: [serviceId], category_ids: [] },
          },
        ],
      })
    );

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "El profesional seleccionado no atiende esa categoría.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("rechaza mover la cita fuera del horario del salón", async () => {
    const lateStart = "2030-01-01T23:00:00.000Z"; // 18:00 en Panamá.
    mockedSchedules.mockResolvedValue([
      { day_of_week: 1, is_active: true, start_time: "00:00", end_time: "23:59" },
    ]);

    expect(await updateAppointmentSchedule(input({ start_time: lateStart }), deps)).toEqual({
      ok: false,
      error: "El horario esta fuera del horario de atención del salon.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("si el RPC lanza una excepción devuelve error de actualización y registra el fallo", async () => {
    const failure = new Error("rpc transport error");
    mockedRpc.mockRejectedValue(failure);

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "Error al actualizar la cita. Intenta de nuevo.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "update",
    });
  });

  it("si el RPC rechaza la actualización por otra causa devuelve el error genérico", async () => {
    mockedRpc.mockResolvedValue({ ok: false, errorMessage: "constraint failed" });

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "Error al actualizar la cita. Intenta de nuevo.",
    });
  });

  it("si el RPC detecta solapamiento devuelve el mensaje de horario ocupado", async () => {
    mockedRpc.mockResolvedValue({ ok: false, errorMessage: "no_overlap_per_employee" });

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "El profesional ya tiene una cita en ese horario. Elige otro horario.",
    });
  });
  it("rechaza si un servicio o profesional de la reprogramación no existe en el salón", async () => {
    mockedResources.mockResolvedValue(
      resources({
        assignments: [{ service: null, employee: resources().assignments[0]?.employee ?? null }],
      })
    );

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      // CONDUCTA ACTUAL (posible bug): mojibake en el mensaje de servicio o profesional no encontrado.
      error: "Servicio o profesional no encontrado en el salón.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("si el RPC rechaza sin mensaje devuelve el error genérico", async () => {
    mockedRpc.mockResolvedValue({ ok: false });

    expect(await updateAppointmentSchedule(input(), deps)).toEqual({
      ok: false,
      error: "Error al actualizar la cita. Intenta de nuevo.",
    });
  });
});
