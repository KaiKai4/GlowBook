import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { getAppointmentReminderTarget } from "@/features/appointments/use-cases/appointment-reminder-target";
import {
  createManualReminderLog,
  findManualReminderSentAt,
  ReminderLogDuplicateError,
} from "../data/reminder-log.repo";
import { recordManualReminder } from "./record-manual-reminder";

vi.mock("@/features/appointments/use-cases/appointment-reminder-target", () => ({
  getAppointmentReminderTarget: vi.fn(),
}));

vi.mock("../data/reminder-log.repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/reminder-log.repo")>();
  return {
    ReminderLogDuplicateError: actual.ReminderLogDuplicateError,
    createManualReminderLog: vi.fn(),
    findManualReminderSentAt: vi.fn(),
  };
});

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

const mockedGetTarget = vi.mocked(getAppointmentReminderTarget);
const mockedCreateLog = vi.mocked(createManualReminderLog);
const mockedFindExisting = vi.mocked(findManualReminderSentAt);
const mockedCaptureError = vi.mocked(captureError);

const KEY = "5f1c2a3e-8b7d-4c6e-9a0b-1d2e3f4a5b6c";
const input = {
  salonId: "salon-1",
  appointmentId: "appt-1",
  templateId: "template-1",
  userId: "user-1",
  idempotencyKey: KEY,
};

describe("recordManualReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra el recordatorio con el telefono de la cita, la clave y devuelve la fecha de envio", async () => {
    mockedGetTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    mockedCreateLog.mockResolvedValue("2026-06-12T10:00:00.000Z");

    expect(await recordManualReminder(input)).toEqual({
      ok: true,
      value: "2026-06-12T10:00:00.000Z",
    });
    expect(mockedGetTarget).toHaveBeenCalledWith("appt-1", "salon-1");
    expect(mockedCreateLog).toHaveBeenCalledWith({
      salonId: "salon-1",
      appointmentId: "appt-1",
      templateId: "template-1",
      recipientPhone: "61234567",
      userId: "user-1",
      idempotencyKey: KEY,
    });
  });

  it("registra sin telefono cuando el cliente de la cita no tiene uno", async () => {
    mockedGetTarget.mockResolvedValue({ salonId: "salon-1" });
    mockedCreateLog.mockResolvedValue("2026-06-12T10:00:00.000Z");

    await recordManualReminder({ salonId: "salon-1", appointmentId: "appt-1", userId: "user-1", idempotencyKey: KEY });

    expect(mockedCreateLog).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: undefined, templateId: undefined, idempotencyKey: KEY })
    );
  });

  it("un doble envío con la misma clave devuelve el registro existente sin duplicarlo", async () => {
    mockedGetTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    mockedCreateLog.mockRejectedValue(new ReminderLogDuplicateError());
    mockedFindExisting.mockResolvedValue("2026-06-12T09:59:00.000Z");

    expect(await recordManualReminder(input)).toEqual({ ok: true, value: "2026-06-12T09:59:00.000Z" });
    expect(mockedFindExisting).toHaveBeenCalledWith({ salonId: "salon-1", appointmentId: "appt-1", idempotencyKey: KEY });
    expect(mockedCaptureError).not.toHaveBeenCalled();
  });

  it("si la clave duplicada no encuentra registro devuelve error generico", async () => {
    mockedGetTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    mockedCreateLog.mockRejectedValue(new ReminderLogDuplicateError());
    mockedFindExisting.mockResolvedValue(null);

    expect(await recordManualReminder(input)).toEqual({
      ok: false,
      error: "No se pudo marcar el recordatorio como enviado.",
    });
  });

  it("no encuentra la cita si no existe", async () => {
    mockedGetTarget.mockResolvedValue(null);

    expect(await recordManualReminder(input)).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(mockedCreateLog).not.toHaveBeenCalled();
  });

  it("no revela citas de otro salon: responde igual que si no existieran", async () => {
    mockedGetTarget.mockResolvedValue({ salonId: "salon-otro", customerPhone: "61234567" });

    expect(await recordManualReminder(input)).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(mockedCreateLog).not.toHaveBeenCalled();
  });

  it("captura el error y devuelve mensaje generico si el registro falla", async () => {
    const failure = new Error("caida");
    mockedGetTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    mockedCreateLog.mockRejectedValue(failure);

    expect(await recordManualReminder(input)).toEqual({
      ok: false,
      error: "No se pudo marcar el recordatorio como enviado.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "reminders", action: "manual" });
  });
});
