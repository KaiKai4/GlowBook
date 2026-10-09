import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import { confirmAppointmentRpc } from "../data/rpc/confirm-appointment";
import { confirmAppointment } from "./confirm-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
}));
vi.mock("../data/rpc/confirm-appointment", () => ({
  confirmAppointmentRpc: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const appointmentId = "00000000-0000-4000-8000-0000000000a2";
const salonId = "00000000-0000-4000-8000-0000000000b2";
const idempotencyKey = "00000000-0000-4000-8000-0000000000c2";

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedRpc = vi.mocked(confirmAppointmentRpc);
const mockedCaptureError = vi.mocked(captureError);

function appointmentIn(status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show") {
  return { id: appointmentId, salon_id: salonId, status, customer_id: null };
}

describe("confirmAppointment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedRpc.mockResolvedValue({ appointment_id: appointmentId, status: "confirmed" });
  });

  it("confirma una cita agendada dentro del salón a través de la RPC transaccional", async () => {
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));

    const result = await confirmAppointment(appointmentId, salonId, idempotencyKey);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedFind).toHaveBeenCalledWith(appointmentId, salonId);
    expect(mockedRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("no confirma una cita que no existe en el salón", async () => {
    mockedFind.mockResolvedValue(null);

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("trata un fallo al buscar la cita como no encontrada y registra el error", async () => {
    const failure = new Error("read failed");
    mockedFind.mockRejectedValue(failure);

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "confirm",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it.each(["confirmed", "completed", "cancelled", "no_show"] as const)(
    "rechaza confirmar una cita en estado %s",
    async (status) => {
      mockedFind.mockResolvedValue(appointmentIn(status));

      expect(await confirmAppointment(appointmentId, salonId, idempotencyKey)).toEqual({
        ok: false,
        error: `No se puede cambiar el estado de "${status}" a "confirmed".`,
      });
      expect(mockedRpc).not.toHaveBeenCalled();
    }
  );

  it("muestra el motivo de dominio si la base rechaza la transición (carrera con cancelar)", async () => {
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));
    mockedRpc.mockRejectedValue({
      code: "P0001",
      message: 'No se puede cambiar el estado de "cancelled" a "confirmed".',
    });

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey)).toEqual({
      ok: false,
      error: 'No se puede cambiar el estado de "cancelled" a "confirmed".',
    });
  });

  it("devuelve error genérico y registra si falla la escritura", async () => {
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));
    const failure = new Error("write failed");
    mockedRpc.mockRejectedValue(failure);

    expect(await confirmAppointment(appointmentId, salonId, idempotencyKey)).toEqual({
      ok: false,
      error: "Error al confirmar la cita.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "errors",
      action: "public-message",
    });
  });
});
