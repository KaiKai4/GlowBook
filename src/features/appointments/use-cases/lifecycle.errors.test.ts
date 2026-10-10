import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { err } from "@/infra/result";
import type { AppointmentCreationResources } from "../data/appointment-command-types";
import {
  createAppointmentCommandFakes,
  createDepsFrom,
  fakeCancelAppointmentDeps,
  fakeCompleteAppointmentDeps,
  fakeConfirmAppointmentDeps,
  updateDepsFrom,
} from "@/test/appointment-command-fakes";
import { cancelAppointment } from "./cancel-appointment";
import { completeAppointment } from "./complete-appointment";
import { confirmAppointment } from "./confirm-appointment";
import { createAppointment } from "./create-appointment";
import { updateAppointmentSchedule } from "./update-appointment";

// Errores y validaciones de dominio de los comandos de cita. Los colaboradores llegan
// como fakes tipados por parámetro; solo se mockea la infraestructura transversal.

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const SALON = "00000000-0000-4000-8000-000000000001";
const OTHER_SALON = "00000000-0000-4000-8000-0000000000ff";
const APPOINTMENT = "00000000-0000-4000-8000-0000000000a1";
const USER = "00000000-0000-4000-8000-0000000000ad";
const KEY = "00000000-0000-4000-8000-0000000000c1";

// Recurso de creacion con un servicio que pertenece a OTRO salon: buildItemPayloads debe rechazarlo.
function foreignServiceResources(): AppointmentCreationResources {
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

const scheduled = { id: APPOINTMENT, salon_id: SALON, status: "scheduled" as const, customer_id: "c" };

let cancelDeps: ReturnType<typeof fakeCancelAppointmentDeps>;
let completeDeps: ReturnType<typeof fakeCompleteAppointmentDeps>;
let confirmDeps: ReturnType<typeof fakeConfirmAppointmentDeps>;
let fakes: ReturnType<typeof createAppointmentCommandFakes>;

beforeEach(() => {
  vi.clearAllMocks();
  cancelDeps = fakeCancelAppointmentDeps();
  completeDeps = fakeCompleteAppointmentDeps();
  confirmDeps = fakeConfirmAppointmentDeps();
  fakes = createAppointmentCommandFakes();
});

describe("cancelar, completar y confirmar cita: transiciones inválidas", () => {
  it("cancelar una cita completada devuelve el motivo de dominio, sin capturar error", async () => {
    cancelDeps.findAppointment.mockResolvedValue({ ...scheduled, status: "completed" });

    const result = await cancelAppointment(
      { appointmentId: APPOINTMENT, salonId: SALON, idempotencyKey: KEY, customerDisposition: "keep" },
      cancelDeps
    );

    expect(result).toEqual(err('No se puede cambiar el estado de "completed" a "cancelled".'));
    expect(captureError).not.toHaveBeenCalled();
  });

  it("completar una cita cancelada devuelve el motivo de dominio", async () => {
    completeDeps.findAppointment.mockResolvedValue({ ...scheduled, status: "cancelled" });

    const result = await completeAppointment(
      { appointmentId: APPOINTMENT, salonId: SALON, paymentMethod: "cash", idempotencyKey: KEY },
      completeDeps
    );

    expect(result).toEqual(err('No se puede cambiar el estado de "cancelled" a "completed".'));
  });

  it("confirmar una cita completada devuelve el motivo de dominio", async () => {
    confirmDeps.findAppointment.mockResolvedValue({ ...scheduled, status: "completed" });

    const result = await confirmAppointment(APPOINTMENT, SALON, KEY, confirmDeps);

    expect(result).toEqual(err('No se puede cambiar el estado de "completed" a "confirmed".'));
  });

  it("si la cita no se puede leer, cancelar informa 'Cita no encontrada.' y registra el error", async () => {
    const failure = new Error("timeout");
    cancelDeps.findAppointment.mockRejectedValue(failure);

    const result = await cancelAppointment(
      { appointmentId: APPOINTMENT, salonId: SALON, idempotencyKey: KEY, customerDisposition: "keep" },
      cancelDeps
    );

    expect(result).toEqual(err("Cita no encontrada."));
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "cancel" });
  });

  it("una cita inexistente no se confirma", async () => {
    confirmDeps.findAppointment.mockResolvedValue(null);

    const result = await confirmAppointment(APPOINTMENT, SALON, KEY, confirmDeps);

    expect(result).toEqual(err("Cita no encontrada."));
  });
});

describe("crear cita: validación de dominio de los servicios", () => {
  it("un servicio de otro salón se rechaza con el mensaje de dominio", async () => {
    fakes.findAppointmentCreationResources.mockResolvedValue(foreignServiceResources());
    const deps = createDepsFrom(fakes);

    const result = await createAppointment(
      {
        customer_id: "customer-1",
        start_time: "2026-06-01T15:00:00.000Z",
        assignments: [{ service_id: "service-1", employee_id: "emp-1" }],
        notes: "",
        idempotency_key: KEY,
      },
      { salonId: SALON, userId: USER, idempotencyKey: KEY },
      deps
    );

    expect(result).toEqual(err("El servicio no pertenece al salón."));
    expect(captureError).not.toHaveBeenCalled();
    expect(fakes.createAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("si no se pueden leer los datos de creación responde 'Datos inválidos.'", async () => {
    const failure = new Error("boom");
    fakes.findAppointmentCreationResources.mockRejectedValue(failure);
    const deps = createDepsFrom(fakes);

    const result = await createAppointment(
      {
        customer_id: "c",
        start_time: "2026-06-01T15:00:00.000Z",
        assignments: [{ service_id: "service-1", employee_id: "emp-1" }],
        notes: "",
        idempotency_key: KEY,
      },
      { salonId: SALON, userId: USER, idempotencyKey: KEY },
      deps
    );

    expect(result).toEqual(err("Datos inválidos."));
    expect(captureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
  });
});

describe("editar horario de cita: validación de dominio de los servicios", () => {
  it("una cita cerrada no se puede editar", async () => {
    const deps = updateDepsFrom(fakes);
    fakes.findAppointmentForCommand.mockResolvedValue({ ...scheduled, status: "completed" });

    const result = await updateAppointmentSchedule(
      { appointment_id: APPOINTMENT, start_time: "2026-06-01T15:00:00.000Z", notes: "", assignments: [], idempotency_key: KEY },
      { salonId: SALON, idempotencyKey: KEY },
      deps
    );

    expect(result).toEqual(err("Esta cita ya está cerrada y no se puede editar."));
  });

  it("un servicio de otro salón al editar se rechaza con el mensaje de dominio", async () => {
    fakes.findAppointmentCreationResources.mockResolvedValue(foreignServiceResources());
    const deps = updateDepsFrom(fakes);
    fakes.findAppointmentForCommand.mockResolvedValue(scheduled);

    const result = await updateAppointmentSchedule(
      {
        appointment_id: APPOINTMENT,
        start_time: "2026-06-01T15:00:00.000Z",
        notes: "",
        assignments: [{ service_id: "service-1", employee_id: "emp-1" }],
        idempotency_key: KEY,
      },
      { salonId: SALON, idempotencyKey: KEY },
      deps
    );

    expect(result).toEqual(err("El servicio no pertenece al salón."));
    expect(captureError).not.toHaveBeenCalled();
    expect(fakes.updateAppointmentWithRpc).not.toHaveBeenCalled();
  });
});
