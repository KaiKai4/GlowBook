import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { recordManualReminder } from "@/features/reminders/use-cases/record-manual-reminder";
import { PERMISSIONS } from "@/features/access";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { err, ok } from "@/infra/result";
import { buildProfile, RECORD_ID, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { confirmReminderAppointmentAction, markReminderSentAction } from "./actions";

const { requireActiveProfile } = vi.hoisted(() => ({ requireActiveProfile: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/appointments/use-cases/confirm-appointment", () => ({
  confirmAppointment: vi.fn(),
}));
vi.mock("@/features/reminders/use-cases/record-manual-reminder", () => ({
  recordManualReminder: vi.fn(),
}));

const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000ee";
const KEY = "5f1c2a3e-8b7d-4c6e-9a0b-1d2e3f4a5b6c";
const INVALID_KEY_MESSAGE = "Solicitud inválida. Recarga la página e inténtalo de nuevo.";
const sender = buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND, PERMISSIONS.APPOINTMENTS_MANAGE] });
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

describe("markReminderSentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(sender);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(recordManualReminder).mockResolvedValue(ok("wa-link"));
  });

  it("rechaza sin consultar el límite cuando el módulo de recordatorios está deshabilitado", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(
      buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND], disabledFeatures: ["recordatorios"] })
    );

    expect(await markReminderSentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual({
      ok: false,
      error: "No tienes permiso para enviar recordatorios.",
    });
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("rechaza con el mismo mensaje cuando el módulo de plantillas está deshabilitado", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(
      buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND], disabledFeatures: ["plantillas"] })
    );

    expect(await markReminderSentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual({
      ok: false,
      error: "No tienes permiso para enviar recordatorios.",
    });
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("rechaza al perfil sin permiso de envío aunque el módulo esté activo", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] }));

    expect((await markReminderSentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).ok).toBe(false);
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite de peticiones sin registrar el recordatorio", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await markReminderSentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual(RATE_LIMITED);
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("aplica el ámbito y el límite de 60 envíos por minuto por usuario", async () => {
    await markReminderSentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }));

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "recordatorios-envio", {
      max: 60,
      windowMs: 60_000,
    });
  });

  it("rechaza un appointment_id que no es UUID", async () => {
    expect(await markReminderSentAction(form({ appointment_id: "cita-1", idempotency_key: KEY }))).toEqual({
      ok: false,
      error: "Identificador inválido.",
    });
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("rechaza una plantilla con identificador inválido cuando se envía explícitamente", async () => {
    expect(
      await markReminderSentAction(form({ appointment_id: RECORD_ID, template_id: "plantilla-1", idempotency_key: KEY }))
    ).toEqual({ ok: false, error: "Identificador inválido." });
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("rechaza la petición sin clave de idempotencia válida", async () => {
    expect(await markReminderSentAction(form({ appointment_id: RECORD_ID }))).toEqual({
      ok: false,
      error: INVALID_KEY_MESSAGE,
    });
    expect(await markReminderSentAction(form({ appointment_id: RECORD_ID, idempotency_key: "no-uuid" }))).toEqual({
      ok: false,
      error: INVALID_KEY_MESSAGE,
    });
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("registra el recordatorio con la plantilla y la clave, y revalida la vista", async () => {
    expect(
      await markReminderSentAction(form({ appointment_id: RECORD_ID, template_id: TEMPLATE_ID, idempotency_key: KEY }))
    ).toEqual(ok("wa-link"));

    expect(recordManualReminder).toHaveBeenCalledWith({
      salonId: SALON_ID,
      appointmentId: RECORD_ID,
      templateId: TEMPLATE_ID,
      userId: USER_ID,
      idempotencyKey: KEY,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/recordatorios");
  });

  it("trata una plantilla vacía como ausencia de plantilla", async () => {
    await markReminderSentAction(form({ appointment_id: RECORD_ID, template_id: "", idempotency_key: KEY }));

    expect(recordManualReminder).toHaveBeenCalledWith(expect.objectContaining({ templateId: undefined }));
  });

  it("no revalida cuando el caso de uso falla y propaga su error", async () => {
    vi.mocked(recordManualReminder).mockResolvedValue(err("La cita no existe."));

    expect(await markReminderSentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual({
      ok: false,
      error: "La cita no existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("confirmReminderAppointmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(sender);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(confirmAppointment).mockResolvedValue(ok(undefined));
  });

  it("rechaza sin permiso de gestión de citas y no consume el límite", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND] }));

    expect(await confirmReminderAppointmentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual({
      ok: false,
      error: "No tienes permiso para confirmar citas.",
    });
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite de peticiones sin confirmar", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await confirmReminderAppointmentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual(
      RATE_LIMITED
    );
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("aplica el ámbito recordatorios-confirmar con 60 peticiones por minuto", async () => {
    await confirmReminderAppointmentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }));

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "recordatorios-confirmar", {
      max: 60,
      windowMs: 60_000,
    });
  });

  it("rechaza un identificador de cita que no es UUID", async () => {
    expect(await confirmReminderAppointmentAction(form({ appointment_id: "no-es-uuid", idempotency_key: KEY }))).toEqual({
      ok: false,
      error: "Identificador inválido.",
    });
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("rechaza la confirmación sin clave de idempotencia", async () => {
    expect(await confirmReminderAppointmentAction(form({ appointment_id: RECORD_ID }))).toEqual({
      ok: false,
      error: INVALID_KEY_MESSAGE,
    });
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("confirma la cita del salón con la clave y revalida recordatorios y agenda", async () => {
    expect(await confirmReminderAppointmentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual(
      ok(undefined)
    );

    expect(confirmAppointment).toHaveBeenCalledWith(RECORD_ID, SALON_ID, KEY);
    expect(revalidatePath).toHaveBeenCalledWith("/recordatorios");
    expect(revalidatePath).toHaveBeenCalledWith("/appointments");
  });

  it("no revalida cuando la confirmación falla", async () => {
    vi.mocked(confirmAppointment).mockResolvedValue(err("La cita ya está cancelada."));

    expect(await confirmReminderAppointmentAction(form({ appointment_id: RECORD_ID, idempotency_key: KEY }))).toEqual({
      ok: false,
      error: "La cita ya está cancelada.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
