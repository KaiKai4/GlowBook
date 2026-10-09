import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { getAppointmentReminderTarget } from "@/features/appointments/use-cases/appointment-reminder-target";
import { createManualReminderLog } from "../data/reminder-log.repo";
import { recordManualReminder } from "./record-manual-reminder";

vi.mock("@/features/appointments/use-cases/appointment-reminder-target", () => ({
  getAppointmentReminderTarget: vi.fn(),
}));

vi.mock("../data/reminder-log.repo", () => ({
  createManualReminderLog: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

const mockedGetTarget = vi.mocked(getAppointmentReminderTarget);
const mockedCreateLog = vi.mocked(createManualReminderLog);
const mockedCaptureError = vi.mocked(captureError);

const input = {
  salonId: "salon-1",
  appointmentId: "appt-1",
  templateId: "template-1",
  userId: "user-1",
};

describe("recordManualReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra el recordatorio con el telefono de la cita y devuelve la fecha de envio", async () => {
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
    });
  });

  it("registra sin telefono cuando el cliente de la cita no tiene uno", async () => {
    mockedGetTarget.mockResolvedValue({ salonId: "salon-1" });
    mockedCreateLog.mockResolvedValue("2026-06-12T10:00:00.000Z");

    await recordManualReminder({ salonId: "salon-1", appointmentId: "appt-1", userId: "user-1" });

    expect(mockedCreateLog).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: undefined, templateId: undefined })
    );
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
