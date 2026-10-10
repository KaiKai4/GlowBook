import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import {
  findAppointmentCreationResources,
  findExceptionDatesByEmployeeForCommand,
  findOccupiedSlotsByEmployeeForCommand,
  findWorkSchedulesByEmployeeForCommand,
  type AppointmentCreationResources,
} from "../data/appointment-commands.repo";
import { createAppointmentWithRpc } from "../data/rpc/create-appointment";
import type { CreateAppointmentInput } from "../schemas";
import { createAppointment } from "./create-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentCreationResources: vi.fn(),
  findExceptionDatesByEmployeeForCommand: vi.fn(),
  findOccupiedSlotsByEmployeeForCommand: vi.fn(),
  findWorkSchedulesByEmployeeForCommand: vi.fn(),
}));
vi.mock("../data/rpc/create-appointment", () => ({
  createAppointmentWithRpc: vi.fn(),
}));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const salonId = "00000000-0000-4000-8000-0000000000f1";
const userId = "00000000-0000-4000-8000-0000000000f2";
const customerId = "00000000-0000-4000-8000-0000000000f3";
const categoryId = "00000000-0000-4000-8000-0000000000f4";
const serviceA = "00000000-0000-4000-8000-0000000000f5";
const serviceB = "00000000-0000-4000-8000-0000000000f6";
const employeeA = "00000000-0000-4000-8000-0000000000f7";
const employeeB = "00000000-0000-4000-8000-0000000000f8";

// 2030-01-01 es martes (day_of_week 1). 09:00 en Panamá son las 14:00 UTC.
const startIso = "2030-01-01T14:00:00.000Z";

const mockedResources = vi.mocked(findAppointmentCreationResources);
const mockedRpc = vi.mocked(createAppointmentWithRpc);
const mockedSchedules = vi.mocked(findWorkSchedulesByEmployeeForCommand);
const mockedExceptions = vi.mocked(findExceptionDatesByEmployeeForCommand);
const mockedOccupied = vi.mocked(findOccupiedSlotsByEmployeeForCommand);
const mockedCaptureError = vi.mocked(captureError);

type Assignment = AppointmentCreationResources["assignments"][number];

function assignment(
  serviceId: string,
  employeeId: string,
  overrides: { duration?: number; categoryIds?: string[] } = {}
): Assignment {
  return {
    service: {
      id: serviceId,
      duration_minutes: overrides.duration ?? 30,
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
      service_ids: [serviceA, serviceB],
      category_ids: overrides.categoryIds ?? [categoryId],
    },
  };
}

function resourcesFor(assignments: Assignment[]): AppointmentCreationResources {
  return {
    customerExists: true,
    salonConfig: {
      timezone: "America/Panama",
      allow_off_hours_bookings: false,
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 15,
    },
    businessHours: [{ day_of_week: 1, is_open: true, open_time: "08:00", close_time: "18:00" }],
    assignments,
  };
}

function input(overrides: Partial<CreateAppointmentInput> = {}): CreateAppointmentInput {
  return {
    customer_id: customerId,
    start_time: startIso,
    notes: "",
    assignments: [{ service_id: serviceA, employee_id: employeeA }],
    idempotency_key: "00000000-0000-4000-8000-0000000000c1",
    ...overrides,
  };
}

const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";
const deps = { salonId, userId, idempotencyKey };

describe("createAppointment: payload del RPC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedResources.mockResolvedValue(resourcesFor([assignment(serviceA, employeeA)]));
    mockedSchedules.mockResolvedValue(new Map([[employeeA, [
      { day_of_week: 1, is_active: true, start_time: "08:00", end_time: "18:00" },
    ]]]));
    mockedExceptions.mockResolvedValue(new Map());
    mockedOccupied.mockResolvedValue(new Map());
    mockedRpc.mockResolvedValue({ ok: true, appointmentId: "appointment-1" });
  });

  it("reenvía la clave de idempotencia del formulario al adaptador RPC", async () => {
    await createAppointment(input(), deps);

    expect(mockedRpc.mock.calls[0]?.[0].idempotencyKey).toBe(idempotencyKey);
  });

  it("envía el salón, el usuario que crea y los ítems con bloqueo de agenda", async () => {
    const result = await createAppointment(input({ notes: "Sin azúcar" }), deps);

    expect(result).toEqual({ ok: true, value: "appointment-1" });
    expect(mockedResources).toHaveBeenCalledWith({
      salonId,
      customerId,
      assignments: [{ service_id: serviceA, employee_id: employeeA }],
    });
    expect(mockedRpc.mock.calls[0]?.[0].payload).toEqual({
      salon_id: salonId,
      customer_id: customerId,
      created_by: userId,
      notes: "Sin azúcar",
      items: [
        {
          salon_id: salonId,
          service_id: serviceA,
          employee_id: employeeA,
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

  it("consulta turnos, excepciones y agenda del profesional con la zona horaria del salón", async () => {
    await createAppointment(input(), deps);

    expect(mockedSchedules).toHaveBeenCalledWith(expect.objectContaining({ employeeIds: [employeeA] }));
    expect(mockedExceptions).toHaveBeenCalledWith(expect.objectContaining({ employeeIds: [employeeA] }));
    expect(mockedOccupied).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId,
        employeeIds: [employeeA],
        date: new Date(startIso),
        timezone: "America/Panama",
      })
    );
  });

  it("encadena dos servicios del mismo profesional y consulta sus turnos una sola vez", async () => {
    mockedResources.mockResolvedValue(
      resourcesFor([assignment(serviceA, employeeA), assignment(serviceB, employeeA, { duration: 45 })])
    );

    const result = await createAppointment(
      input({
        assignments: [
          { service_id: serviceA, employee_id: employeeA },
          { service_id: serviceB, employee_id: employeeA },
        ],
      }),
      deps
    );

    expect(result.ok).toBe(true);
    expect(mockedSchedules).toHaveBeenCalledTimes(1);
    expect(mockedOccupied).toHaveBeenCalledTimes(1);
    const items = mockedRpc.mock.calls[0]?.[0].payload.items ?? [];
    expect(items.map((item) => [item.service_id, item.ordering, item.start_time, item.end_time])).toEqual([
      [serviceA, 1, startIso, "2030-01-01T14:30:00.000Z"],
      [serviceB, 2, "2030-01-01T14:30:00.000Z", "2030-01-01T15:15:00.000Z"],
    ]);
  });

  it("consulta la agenda de cada profesional distinto", async () => {
    mockedResources.mockResolvedValue(
      resourcesFor([assignment(serviceA, employeeA), assignment(serviceB, employeeB)])
    );

    await createAppointment(
      input({
        assignments: [
          { service_id: serviceA, employee_id: employeeA },
          { service_id: serviceB, employee_id: employeeB },
        ],
      }),
      deps
    );

    expect(mockedSchedules).toHaveBeenCalledTimes(1);
    expect(mockedSchedules).toHaveBeenCalledWith(expect.objectContaining({ employeeIds: [employeeA, employeeB] }));
    expect(mockedOccupied).toHaveBeenCalledTimes(1);
    expect(mockedOccupied).toHaveBeenCalledWith(expect.objectContaining({ employeeIds: [employeeA, employeeB] }));
  });
});

describe("createAppointment: reglas de dominio antes del RPC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSchedules.mockResolvedValue(new Map([[employeeA, [
      { day_of_week: 1, is_active: true, start_time: "00:00", end_time: "23:59" },
    ]]]));
    mockedExceptions.mockResolvedValue(new Map());
    mockedOccupied.mockResolvedValue(new Map());
    mockedRpc.mockResolvedValue({ ok: true, appointmentId: "appointment-1" });
  });

  it("rechaza una cita que choca con otra del profesional sin llamar al RPC", async () => {
    mockedResources.mockResolvedValue(resourcesFor([assignment(serviceA, employeeA)]));
    mockedOccupied.mockResolvedValue(new Map([[employeeA, [
      { start_time: "2030-01-01T14:10:00.000Z", end_time: "2030-01-01T14:20:00.000Z" },
    ]]]));

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "El profesional ya tiene una cita en ese horario.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("rechaza el día libre puntual del profesional usando la fecha local del salón", async () => {
    mockedResources.mockResolvedValue(resourcesFor([assignment(serviceA, employeeA)]));
    mockedExceptions.mockResolvedValue(new Map([[employeeA, ["2030-01-01"]]]));

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "El profesional tiene el día libre en esa fecha.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("rechaza un profesional que no atiende la categoría del servicio", async () => {
    mockedResources.mockResolvedValue(
      resourcesFor([assignment(serviceA, employeeA, { categoryIds: ["otra-categoria"] })])
    );

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "El profesional seleccionado no atiende esa categoría.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("aplica la duración mínima global del salón al total de la cita", async () => {
    mockedResources.mockResolvedValue(
      resourcesFor([assignment(serviceA, employeeA, { duration: 10 })])
    );

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "La duración minima es 15 minutos.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("aplica el horario del salón al total de la cita aunque el profesional esté disponible", async () => {
    mockedResources.mockResolvedValue(resourcesFor([assignment(serviceA, employeeA)]));

    const lateStart = "2030-01-01T23:00:00.000Z"; // 18:00 en Panamá, al cierre.
    expect(await createAppointment(input({ start_time: lateStart }), deps)).toEqual({
      ok: false,
      error: "El horario esta fuera del horario de atención del salon.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});

describe("createAppointment: errores del RPC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedResources.mockResolvedValue(resourcesFor([assignment(serviceA, employeeA)]));
    mockedSchedules.mockResolvedValue(new Map([[employeeA, [
      { day_of_week: 1, is_active: true, start_time: "08:00", end_time: "18:00" },
    ]]]));
    mockedExceptions.mockResolvedValue(new Map());
    mockedOccupied.mockResolvedValue(new Map());
  });

  it("si el RPC lanza una excepción devuelve error genérico y registra el fallo", async () => {
    const failure = new Error("rpc transport error");
    mockedRpc.mockRejectedValue(failure);

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "Error al crear la cita. Intenta de nuevo.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "create",
    });
  });

  it("si el RPC rechaza la cita por otra causa devuelve el error genérico", async () => {
    mockedRpc.mockResolvedValue({ ok: false, errorMessage: "check constraint failed" });

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "Error al crear la cita. Intenta de nuevo.",
    });
  });

  it("devuelve el id de la cita creada cuando el RPC confirma", async () => {
    mockedRpc.mockResolvedValue({ ok: true, appointmentId: "appointment-9" });

    expect(await createAppointment(input(), deps)).toEqual({ ok: true, value: "appointment-9" });
  });

  it("si el RPC rechaza sin mensaje devuelve el error genérico", async () => {
    mockedRpc.mockResolvedValue({ ok: false });

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "Error al crear la cita. Intenta de nuevo.",
    });
  });

  it("rechaza si un servicio o profesional no existe en el salón sin consultar la agenda", async () => {
    mockedResources.mockResolvedValue(
      resourcesFor([
        { service: null, employee: assignment(serviceA, employeeA).employee },
      ])
    );

    expect(await createAppointment(input(), deps)).toEqual({
      ok: false,
      error: "Servicio o profesional no encontrado en el salón.",
    });
    expect(mockedSchedules).not.toHaveBeenCalled();
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});
