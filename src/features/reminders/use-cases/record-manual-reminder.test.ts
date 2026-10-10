import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { ReminderLogDuplicateError } from "../data/reminder-log.repo";
import { recordManualReminder, type RecordManualReminderDeps } from "./record-manual-reminder";

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const getReminderTarget = vi.fn<RecordManualReminderDeps["getReminderTarget"]>();
const createLog = vi.fn<RecordManualReminderDeps["createLog"]>();
const findExistingSentAt = vi.fn<RecordManualReminderDeps["findExistingSentAt"]>();
const deps: RecordManualReminderDeps = { getReminderTarget, createLog, findExistingSentAt };
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

  it("registra el recordatorio con el teléfono de la cita, la clave y devuelve la fecha de envio", async () => {
    getReminderTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    createLog.mockResolvedValue("2026-06-12T10:00:00.000Z");

    expect(await recordManualReminder(input, deps)).toEqual({
      ok: true,
      value: "2026-06-12T10:00:00.000Z",
    });
    expect(getReminderTarget).toHaveBeenCalledWith("appt-1", "salon-1");
    expect(createLog).toHaveBeenCalledWith({
      salonId: "salon-1",
      appointmentId: "appt-1",
      templateId: "template-1",
      recipientPhone: "61234567",
      userId: "user-1",
      idempotencyKey: KEY,
    });
  });

  it("registra sin teléfono cuando el cliente de la cita no tiene uno", async () => {
    getReminderTarget.mockResolvedValue({ salonId: "salon-1" });
    createLog.mockResolvedValue("2026-06-12T10:00:00.000Z");

    await recordManualReminder(
      { salonId: "salon-1", appointmentId: "appt-1", userId: "user-1", idempotencyKey: KEY },
      deps
    );

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: undefined, templateId: undefined, idempotencyKey: KEY })
    );
  });

  it("un doble envío con la misma clave devuelve el registro existente sin duplicarlo", async () => {
    getReminderTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    createLog.mockRejectedValue(new ReminderLogDuplicateError());
    findExistingSentAt.mockResolvedValue("2026-06-12T09:59:00.000Z");

    expect(await recordManualReminder(input, deps)).toEqual({ ok: true, value: "2026-06-12T09:59:00.000Z" });
    expect(findExistingSentAt).toHaveBeenCalledWith({ salonId: "salon-1", appointmentId: "appt-1", idempotencyKey: KEY });
    expect(mockedCaptureError).not.toHaveBeenCalled();
  });

  it("si la clave duplicada no encuentra registro devuelve error generico", async () => {
    getReminderTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    createLog.mockRejectedValue(new ReminderLogDuplicateError());
    findExistingSentAt.mockResolvedValue(null);

    expect(await recordManualReminder(input, deps)).toEqual({
      ok: false,
      error: "No se pudo marcar el recordatorio como enviado.",
    });
  });

  it("si la búsqueda del duplicado falla captura el error y devuelve mensaje generico", async () => {
    const failure = new Error("caida al buscar");
    getReminderTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    createLog.mockRejectedValue(new ReminderLogDuplicateError());
    findExistingSentAt.mockRejectedValue(failure);

    expect(await recordManualReminder(input, deps)).toEqual({
      ok: false,
      error: "No se pudo marcar el recordatorio como enviado.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "reminders", action: "manual-duplicate" });
  });

  it("no encuentra la cita si no existe", async () => {
    getReminderTarget.mockResolvedValue(null);

    expect(await recordManualReminder(input, deps)).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(createLog).not.toHaveBeenCalled();
  });

  it("no revela citas de otro salón: responde igual que si no existieran", async () => {
    getReminderTarget.mockResolvedValue({ salonId: "salon-otro", customerPhone: "61234567" });

    expect(await recordManualReminder(input, deps)).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(createLog).not.toHaveBeenCalled();
  });

  it("captura el error y devuelve mensaje generico si el registro falla", async () => {
    const failure = new Error("caida");
    getReminderTarget.mockResolvedValue({ salonId: "salon-1", customerPhone: "61234567" });
    createLog.mockRejectedValue(failure);

    expect(await recordManualReminder(input, deps)).toEqual({
      ok: false,
      error: "No se pudo marcar el recordatorio como enviado.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "reminders", action: "manual" });
  });
});
