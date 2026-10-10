import { describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import type { AppointmentCommandState } from "../data/appointment-commands.repo";
import { confirmAppointment, type ConfirmAppointmentDeps } from "./confirm-appointment";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const appointmentId = "00000000-0000-4000-8000-0000000000a2";
const salonId = "00000000-0000-4000-8000-0000000000b2";
const idempotencyKey = "00000000-0000-4000-8000-0000000000c2";

const mockedCaptureError = vi.mocked(captureError);

type AppointmentStatus = AppointmentCommandState["status"];

function appointmentIn(status: AppointmentStatus): AppointmentCommandState {
  return { id: appointmentId, salon_id: salonId, status, customer_id: null };
}

/** Fakes tipados de las dependencias: por defecto, cita agendada y RPC correcta. */
function makeDeps(overrides: Partial<ConfirmAppointmentDeps> = {}): ConfirmAppointmentDeps {
  return {
    findAppointment: vi.fn<ConfirmAppointmentDeps["findAppointment"]>(async () => appointmentIn("scheduled")),
    confirmRpc: vi.fn<ConfirmAppointmentDeps["confirmRpc"]>(async () => ({
      appointment_id: appointmentId,
      status: "confirmed",
    })),
    ...overrides,
  };
}

describe("confirmAppointment", () => {
  it("confirma una cita agendada dentro del salón a través de la RPC transaccional", async () => {
    const deps = makeDeps();

    const result = await confirmAppointment(appointmentId, salonId, idempotencyKey, deps);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deps.findAppointment).toHaveBeenCalledWith(appointmentId, salonId);
    expect(deps.confirmRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("no confirma una cita que no existe en el salón", async () => {
    const deps = makeDeps({ findAppointment: async () => null });

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey, deps)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(deps.confirmRpc).not.toHaveBeenCalled();
  });

  it("trata un fallo al buscar la cita como no encontrada y registra el error", async () => {
    const failure = new Error("read failed");
    const deps = makeDeps({
      findAppointment: async () => {
        throw failure;
      },
    });

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey, deps)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "confirm",
    });
    expect(deps.confirmRpc).not.toHaveBeenCalled();
  });

  it.each(["confirmed", "completed", "cancelled", "no_show"] as const)(
    "rechaza confirmar una cita en estado %s",
    async (status) => {
      const deps = makeDeps({ findAppointment: async () => appointmentIn(status) });

      expect(await confirmAppointment(appointmentId, salonId, idempotencyKey, deps)).toEqual({
        ok: false,
        error: `No se puede cambiar el estado de "${status}" a "confirmed".`,
      });
      expect(deps.confirmRpc).not.toHaveBeenCalled();
    }
  );

  it("muestra el motivo de dominio si la base rechaza la transición (carrera con cancelar)", async () => {
    const deps = makeDeps({
      confirmRpc: async () => {
        throw { code: "P0001", message: 'No se puede cambiar el estado de "cancelled" a "confirmed".' };
      },
    });

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey, deps)).toEqual({
      ok: false,
      error: 'No se puede cambiar el estado de "cancelled" a "confirmed".',
    });
  });

  it("devuelve error genérico y registra si falla la escritura", async () => {
    const failure = new Error("write failed");
    const deps = makeDeps({
      confirmRpc: async () => {
        throw failure;
      },
    });

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey, deps)).toEqual({
      ok: false,
      error: "Error al confirmar la cita.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "errors",
      action: "public-message",
    });
  });
});
