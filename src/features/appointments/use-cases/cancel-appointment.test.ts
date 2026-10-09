import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import { cancelAppointmentRpc } from "../data/rpc/cancel-appointment";
import { cancelAppointment } from "./cancel-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
}));
vi.mock("../data/rpc/cancel-appointment", () => ({
  cancelAppointmentRpc: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const appointmentId = "00000000-0000-4000-8000-0000000000a1";
const salonId = "00000000-0000-4000-8000-0000000000b1";
const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedRpc = vi.mocked(cancelAppointmentRpc);
const mockedCaptureError = vi.mocked(captureError);

function appointmentIn(status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show") {
  return { id: appointmentId, salon_id: salonId, status, customer_id: null };
}

describe("cancelAppointment: estado y agenda", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));
    mockedRpc.mockResolvedValue({ appointment_id: appointmentId, status: "cancelled" });
  });

  it("cierra la cita y libera la agenda en una única RPC, dentro del salón", async () => {
    const result = await cancelAppointment(appointmentId, salonId, idempotencyKey);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedFind).toHaveBeenCalledWith(appointmentId, salonId);
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("confirmed también puede cancelarse", async () => {
    mockedFind.mockResolvedValue(appointmentIn("confirmed"));

    expect(await cancelAppointment(appointmentId, salonId)).toEqual({ ok: true, value: undefined });
    expect(mockedRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey: undefined });
  });

  it("no llama a la RPC si la cita no existe en el salón", async () => {
    mockedFind.mockResolvedValue(null);

    expect(await cancelAppointment(appointmentId, salonId)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("trata un fallo al buscar la cita como no encontrada y registra el error", async () => {
    const failure = new Error("connection lost");
    mockedFind.mockRejectedValue(failure);

    expect(await cancelAppointment(appointmentId, salonId)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "cancel",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "rechaza cancelar una cita en estado %s sin llamar a la RPC",
    async (status) => {
      mockedFind.mockResolvedValue(appointmentIn(status));

      expect(await cancelAppointment(appointmentId, salonId)).toEqual({
        ok: false,
        error: `No se puede cambiar el estado de "${status}" a "cancelled".`,
      });
      expect(mockedRpc).not.toHaveBeenCalled();
    }
  );
});

describe("cancelAppointment: fallos de la RPC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));
  });

  it("un fallo interno devuelve el mensaje genérico y registra el error", async () => {
    const failure = new Error("write failed");
    mockedRpc.mockRejectedValue(failure);

    expect(await cancelAppointment(appointmentId, salonId)).toEqual({
      ok: false,
      error: "Error al cancelar la cita.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "errors",
      action: "public-message",
    });
  });

  it("muestra el motivo de dominio si la base rechaza la transición (carrera con completar)", async () => {
    mockedRpc.mockRejectedValue({
      code: "P0001",
      message: 'No se puede cambiar el estado de "completed" a "cancelled".',
    });

    expect(await cancelAppointment(appointmentId, salonId)).toEqual({
      ok: false,
      error: 'No se puede cambiar el estado de "completed" a "cancelled".',
    });
  });
});
