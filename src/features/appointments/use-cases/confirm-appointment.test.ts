import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { findAppointmentForCommand, updateAppointmentStatus } from "../data/appointment-commands.repo";
import { confirmAppointment } from "./confirm-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const appointmentId = "00000000-0000-4000-8000-0000000000a2";
const salonId = "00000000-0000-4000-8000-0000000000b2";

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedUpdateStatus = vi.mocked(updateAppointmentStatus);
const mockedCaptureError = vi.mocked(captureError);

function appointmentIn(status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show") {
  return { id: appointmentId, salon_id: salonId, status, customer_id: null };
}

describe("confirmAppointment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUpdateStatus.mockResolvedValue(undefined);
  });

  it("confirma una cita agendada dentro del salón", async () => {
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));

    const result = await confirmAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedFind).toHaveBeenCalledWith(appointmentId, salonId);
    expect(mockedUpdateStatus).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      status: "confirmed",
    });
  });

  it("no confirma una cita que no existe en el salón", async () => {
    mockedFind.mockResolvedValue(null);

    expect(await confirmAppointment(appointmentId, salonId)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });

  it("trata un fallo al buscar la cita como no encontrada y registra el error", async () => {
    const failure = new Error("read failed");
    mockedFind.mockRejectedValue(failure);

    expect(await confirmAppointment(appointmentId, salonId)).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "confirm",
    });
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });

  it.each(["confirmed", "completed", "cancelled", "no_show"] as const)(
    "rechaza confirmar una cita en estado %s",
    async (status) => {
      mockedFind.mockResolvedValue(appointmentIn(status));

      expect(await confirmAppointment(appointmentId, salonId)).toEqual({
        ok: false,
        error: `No se puede cambiar el estado de "${status}" a "confirmed".`,
      });
      expect(mockedUpdateStatus).not.toHaveBeenCalled();
    }
  );

  it("devuelve error y registra si falla la escritura del estado", async () => {
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));
    const failure = new Error("write failed");
    mockedUpdateStatus.mockRejectedValue(failure);

    expect(await confirmAppointment(appointmentId, salonId)).toEqual({
      ok: false,
      error: "Error al confirmar la cita.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "confirm",
    });
  });
});
