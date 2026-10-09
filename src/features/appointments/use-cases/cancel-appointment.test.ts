import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import {
  findAppointmentForCommand,
  setAppointmentItemsCalendarBlocking,
  updateAppointmentStatus,
} from "../data/appointment-commands.repo";
import { cancelAppointment } from "./cancel-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
  setAppointmentItemsCalendarBlocking: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const appointmentId = "00000000-0000-4000-8000-0000000000a1";
const salonId = "00000000-0000-4000-8000-0000000000b1";

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedRelease = vi.mocked(setAppointmentItemsCalendarBlocking);
const mockedUpdateStatus = vi.mocked(updateAppointmentStatus);
const mockedCaptureError = vi.mocked(captureError);

function appointmentIn(status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show") {
  return { id: appointmentId, salon_id: salonId, status, customer_id: null };
}

describe("cancelAppointment: estado y agenda", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));
    mockedRelease.mockResolvedValue(undefined);
    mockedUpdateStatus.mockResolvedValue(undefined);
  });

  it("libera la agenda antes de marcar la cita como cancelada, siempre dentro del salón", async () => {
    const order: string[] = [];
    mockedRelease.mockImplementation(async () => {
      order.push("release");
    });
    mockedUpdateStatus.mockImplementation(async () => {
      order.push("status");
    });

    const result = await cancelAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(order).toEqual(["release", "status"]);
    expect(mockedFind).toHaveBeenCalledWith(appointmentId, salonId);
    expect(mockedRelease).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
    expect(mockedUpdateStatus).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      status: "cancelled",
    });
  });

  it("confirmed también puede cancelarse", async () => {
    mockedFind.mockResolvedValue(appointmentIn("confirmed"));

    expect(await cancelAppointment(appointmentId, salonId)).toEqual({ ok: true, value: undefined });
    expect(mockedUpdateStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
  });

  it("no toca la agenda ni el estado si la cita no existe en el salón", async () => {
    mockedFind.mockResolvedValue(null);

    const result = await cancelAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(mockedRelease).not.toHaveBeenCalled();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });

  it("trata un fallo al buscar la cita como no encontrada y registra el error", async () => {
    const failure = new Error("connection lost");
    mockedFind.mockRejectedValue(failure);

    const result = await cancelAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "cancel",
    });
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "rechaza cancelar una cita en estado %s sin escribir nada",
    async (status) => {
      mockedFind.mockResolvedValue(appointmentIn(status));

      const result = await cancelAppointment(appointmentId, salonId);

      expect(result).toEqual({
        ok: false,
        error: `No se puede cambiar el estado de "${status}" a "cancelled".`,
      });
      expect(mockedRelease).not.toHaveBeenCalled();
      expect(mockedUpdateStatus).not.toHaveBeenCalled();
    }
  );
});

describe("cancelAppointment: fallos de escritura", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(appointmentIn("scheduled"));
    mockedRelease.mockResolvedValue(undefined);
    mockedUpdateStatus.mockResolvedValue(undefined);
  });

  it("si falla liberar la agenda no cambia el estado y devuelve error", async () => {
    const failure = new Error("write failed");
    mockedRelease.mockRejectedValue(failure);

    const result = await cancelAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: false, error: "Error al liberar la agenda." });
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "cancel",
    });
  });

  it("si falla el cambio de estado devuelve error aunque la agenda ya se liberó", async () => {
    // CONDUCTA ACTUAL (posible bug): cancel-appointment.ts libera la agenda antes de
    // cambiar el estado; si esa segunda escritura falla, la cita queda agendada sin bloqueo.
    const failure = new Error("status write failed");
    mockedUpdateStatus.mockRejectedValue(failure);

    const result = await cancelAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: false, error: "Error al cancelar la cita." });
    expect(mockedRelease).toHaveBeenCalledTimes(1);
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "cancel",
    });
  });
});
