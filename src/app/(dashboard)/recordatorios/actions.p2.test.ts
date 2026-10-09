import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { recordManualReminder } from "@/features/reminders/use-cases/record-manual-reminder";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { err, ok } from "@/lib/result";
import { buildProfile, RECORD_ID, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { confirmReminderAppointmentAction, markReminderSentAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/appointments/use-cases/confirm-appointment", () => ({
  confirmAppointment: vi.fn(),
}));
vi.mock("@/features/reminders/use-cases/record-manual-reminder", () => ({
  recordManualReminder: vi.fn(),
}));

const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000ee";
const sender = buildProfile({ permissions: [PERMISSIONS.REMINDERS_SEND, PERMISSIONS.APPOINTMENTS_MANAGE] });
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;

describe("markReminderSentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(sender);
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(recordManualReminder).mockResolvedValue(ok("wa-link"));
  });

  it("rechaza sin consultar el límite cuando el módulo de recordatorios está deshabilitado", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

    expect(await markReminderSentAction(RECORD_ID)).toEqual({
      ok: false,
      error: "No tienes permiso para enviar recordatorios.",
    });
    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(sender, "recordatorios");
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("rechaza al perfil sin permiso de envío aunque el módulo esté activo", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] }));

    expect((await markReminderSentAction(RECORD_ID)).ok).toBe(false);
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite de peticiones sin registrar el recordatorio", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await markReminderSentAction(RECORD_ID)).toEqual(RATE_LIMITED);
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("aplica el ámbito y el límite de 60 envíos por minuto por usuario", async () => {
    await markReminderSentAction(RECORD_ID);

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "recordatorios-envio", {
      max: 60,
      windowMs: 60_000,
    });
  });

  it("rechaza un appointmentId que no es UUID", async () => {
    expect(await markReminderSentAction("cita-1")).toEqual({ ok: false, error: "Identificador inválido." });
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("rechaza una plantilla con identificador inválido cuando se envía explícitamente", async () => {
    expect(await markReminderSentAction(RECORD_ID, "plantilla-1")).toEqual({
      ok: false,
      error: "Identificador inválido.",
    });
    expect(recordManualReminder).not.toHaveBeenCalled();
  });

  it("registra el recordatorio con la plantilla indicada y revalida la vista de recordatorios", async () => {
    expect(await markReminderSentAction(RECORD_ID, TEMPLATE_ID)).toEqual(ok("wa-link"));

    expect(recordManualReminder).toHaveBeenCalledWith({
      salonId: SALON_ID,
      appointmentId: RECORD_ID,
      templateId: TEMPLATE_ID,
      userId: USER_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/recordatorios");
  });

  it("acepta la ausencia de plantilla y pasa templateId como undefined", async () => {
    await markReminderSentAction(RECORD_ID);

    expect(recordManualReminder).toHaveBeenCalledWith({
      salonId: SALON_ID,
      appointmentId: RECORD_ID,
      templateId: undefined,
      userId: USER_ID,
    });
  });

  it("no revalida cuando el caso de uso falla y propaga su error", async () => {
    vi.mocked(recordManualReminder).mockResolvedValue(err("La cita no existe."));

    expect(await markReminderSentAction(RECORD_ID)).toEqual({ ok: false, error: "La cita no existe." });
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

    expect(await confirmReminderAppointmentAction(RECORD_ID)).toEqual({
      ok: false,
      error: "No tienes permiso para confirmar citas.",
    });
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite de peticiones sin confirmar", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await confirmReminderAppointmentAction(RECORD_ID)).toEqual(RATE_LIMITED);
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("aplica el ámbito recordatorios-confirmar con 60 peticiones por minuto", async () => {
    await confirmReminderAppointmentAction(RECORD_ID);

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "recordatorios-confirmar", {
      max: 60,
      windowMs: 60_000,
    });
  });

  it("rechaza un identificador de cita que no es UUID", async () => {
    expect(await confirmReminderAppointmentAction("no-es-uuid")).toEqual({
      ok: false,
      error: "Identificador inválido.",
    });
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("confirma la cita del salón y revalida recordatorios y agenda", async () => {
    expect(await confirmReminderAppointmentAction(RECORD_ID)).toEqual(ok(undefined));

    expect(confirmAppointment).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/recordatorios");
    expect(revalidatePath).toHaveBeenCalledWith("/appointments");
  });

  it("no revalida cuando la confirmación falla", async () => {
    vi.mocked(confirmAppointment).mockResolvedValue(err("La cita ya está cancelada."));

    expect(await confirmReminderAppointmentAction(RECORD_ID)).toEqual({
      ok: false,
      error: "La cita ya está cancelada.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
