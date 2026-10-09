import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { err } from "@/lib/result";
import {
  findAppointmentCreationResources,
  findAppointmentForCommand,
  findEmployeeExceptionDatesForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
} from "../data/appointment-commands.repo";
import { cancelAppointment } from "./cancel-appointment";
import { completeAppointment } from "./complete-appointment";
import { confirmAppointment } from "./confirm-appointment";
import { createAppointment } from "./create-appointment";
import { updateAppointmentSchedule } from "./update-appointment";

vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentCreationResources: vi.fn(),
  findAppointmentForCommand: vi.fn(),
  findEmployeeExceptionDatesForCommand: vi.fn(),
  findEmployeeOccupiedSlotsForCommand: vi.fn(),
  findEmployeeWorkSchedulesForCommand: vi.fn(),
  setAppointmentItemsCalendarBlocking: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));
vi.mock("../data/rpc/create-appointment", () => ({ createAppointmentWithRpc: vi.fn() }));
vi.mock("../data/rpc/update-appointment", () => ({ updateAppointmentWithRpc: vi.fn() }));

const SALON = "00000000-0000-4000-8000-000000000001";
const OTHER_SALON = "00000000-0000-4000-8000-0000000000ff";
const APPOINTMENT = "00000000-0000-4000-8000-0000000000a1";
const USER = "00000000-0000-4000-8000-0000000000ad";
const KEY = "00000000-0000-4000-8000-0000000000c1";

// Recurso de creacion con un servicio que pertenece a OTRO salon: buildItemPayloads debe rechazarlo.
function foreignServiceResources() {
  return {
    customerExists: true,
    salonConfig: {
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 15,
      allow_off_hours_bookings: true,
      timezone: "UTC",
    },
    businessHours: [],
    assignments: [
      {
        service: {
          id: "service-1",
          duration_minutes: 30,
          price: 100,
          salon_id: OTHER_SALON,
          is_active: true,
          category_id: "cat-1",
        },
        employee: {
          id: "emp-1",
          salon_id: SALON,
          is_active: true,
          profile_id: null,
          service_ids: ["service-1"],
          category_ids: ["cat-1"],
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findEmployeeWorkSchedulesForCommand).mockResolvedValue([]);
  vi.mocked(findEmployeeExceptionDatesForCommand).mockResolvedValue([]);
  vi.mocked(findEmployeeOccupiedSlotsForCommand).mockResolvedValue([]);
});

describe("cancelar, completar y confirmar cita: transiciones invalidas", () => {
  it("cancelar una cita completada devuelve el motivo de dominio, sin capturar error", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue({ status: "completed" } as never);

    const result = await cancelAppointment(APPOINTMENT, SALON, KEY);

    expect(result).toEqual(err('No se puede cambiar el estado de "completed" a "cancelled".'));
    expect(captureError).not.toHaveBeenCalled();
  });

  it("completar una cita cancelada devuelve el motivo de dominio", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue({ status: "cancelled" } as never);

    const result = await completeAppointment(APPOINTMENT, SALON, "cash", [], "", KEY);

    expect(result).toEqual(err('No se puede cambiar el estado de "cancelled" a "completed".'));
  });

  it("confirmar una cita completada devuelve el motivo de dominio", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue({ status: "completed" } as never);

    const result = await confirmAppointment(APPOINTMENT, SALON, KEY);

    expect(result).toEqual(err('No se puede cambiar el estado de "completed" a "confirmed".'));
  });

  it("si la cita no se puede leer, cancelar informa 'Cita no encontrada.' y registra el error", async () => {
    const failure = new Error("timeout");
    vi.mocked(findAppointmentForCommand).mockRejectedValue(failure);

    const result = await cancelAppointment(APPOINTMENT, SALON, KEY);

    expect(result).toEqual(err("Cita no encontrada."));
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "cancel" });
  });

  it("una cita inexistente no se confirma", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue(null as never);

    const result = await confirmAppointment(APPOINTMENT, SALON, KEY);

    expect(result).toEqual(err("Cita no encontrada."));
  });
});

describe("crear cita: validacion de dominio de los servicios", () => {
  it("un servicio de otro salon se rechaza con el mensaje de dominio", async () => {
    vi.mocked(findAppointmentCreationResources).mockResolvedValue(foreignServiceResources() as never);

    const result = await createAppointment(
      {
        customer_id: "customer-1",
        start_time: "2026-06-01T15:00:00.000Z",
        assignments: [{ service_id: "service-1", employee_id: "emp-1" }],
      } as never,
      { salonId: SALON, userId: USER, idempotencyKey: KEY }
    );

    expect(result).toEqual(err("El servicio no pertenece al salón."));
    expect(captureError).not.toHaveBeenCalled();
  });

  it("si no se pueden leer los datos de creacion responde 'Datos inválidos.'", async () => {
    const failure = new Error("boom");
    vi.mocked(findAppointmentCreationResources).mockRejectedValue(failure);

    const result = await createAppointment(
      { customer_id: "c", start_time: "2026-06-01T15:00:00.000Z", assignments: [] } as never,
      { salonId: SALON, userId: USER, idempotencyKey: KEY }
    );

    expect(result).toEqual(err("Datos inválidos."));
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
  });
});

describe("editar horario de cita: validacion de dominio de los servicios", () => {
  it("una cita cerrada no se puede editar", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue({ status: "completed", customer_id: "c" } as never);

    const result = await updateAppointmentSchedule(
      { appointment_id: APPOINTMENT, start_time: "2026-06-01T15:00:00.000Z", assignments: [] } as never,
      { salonId: SALON, idempotencyKey: KEY }
    );

    expect(result).toEqual(err("Esta cita ya está cerrada y no se puede editar."));
  });

  it("un servicio de otro salon al editar se rechaza con el mensaje de dominio", async () => {
    vi.mocked(findAppointmentForCommand).mockResolvedValue({ status: "scheduled", customer_id: "c" } as never);
    vi.mocked(findAppointmentCreationResources).mockResolvedValue(foreignServiceResources() as never);

    const result = await updateAppointmentSchedule(
      {
        appointment_id: APPOINTMENT,
        start_time: "2026-06-01T15:00:00.000Z",
        assignments: [{ service_id: "service-1", employee_id: "emp-1" }],
      } as never,
      { salonId: SALON, idempotencyKey: KEY }
    );

    expect(result).toEqual(err("El servicio no pertenece al salón."));
    expect(captureError).not.toHaveBeenCalled();
  });
});
