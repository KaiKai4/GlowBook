"use server";

import { revalidatePath } from "next/cache";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { requireActiveProfile } from "@/infra/auth/session";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { parseUuid } from "@/infra/validation/route-id";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { recordManualReminder } from "@/features/reminders/use-cases/record-manual-reminder";
import type { Result } from "@/infra/result";

const INVALID_ID = "Identificador inválido.";
const INVALID_KEY = "Solicitud inválida. Recarga la página e inténtalo de nuevo.";

// FormData: appointment_id, template_id (opcional) e idempotency_key (uuid).
export async function markReminderSentAction(formData: FormData): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  const remindersEnabled = await isEffectiveSalonModuleEnabled(profile, "recordatorios");

  if (!remindersEnabled || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para enviar recordatorios." };
  }

  const limited = await assertActionRateLimit(profile.id, "recordatorios-envio", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;

  const appointmentId = readField(formData, "appointment_id");
  const templateId = readField(formData, "template_id") || undefined;
  const idempotencyKey = readField(formData, "idempotency_key");

  if (!parseUuid(appointmentId)) return { ok: false, error: INVALID_ID };
  if (templateId !== undefined && !parseUuid(templateId)) return { ok: false, error: INVALID_ID };
  if (!parseUuid(idempotencyKey)) return { ok: false, error: INVALID_KEY };

  const result = await recordManualReminder({
    salonId: profile.salon_id,
    appointmentId,
    templateId,
    userId: profile.id,
    idempotencyKey,
  });

  if (result.ok) revalidatePath("/recordatorios");
  return result;
}

// FormData: appointment_id e idempotency_key (uuid).
export async function confirmReminderAppointmentAction(formData: FormData): Promise<Result<void>> {
  const profile = await requireActiveProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para confirmar citas." };
  }

  const limited = await assertActionRateLimit(profile.id, "recordatorios-confirmar", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;

  const appointmentId = readField(formData, "appointment_id");
  const idempotencyKey = readField(formData, "idempotency_key");

  if (!parseUuid(appointmentId)) return { ok: false, error: INVALID_ID };
  if (!parseUuid(idempotencyKey)) return { ok: false, error: INVALID_KEY };

  const result = await confirmAppointment(appointmentId, profile.salon_id, idempotencyKey);

  if (result.ok) {
    revalidatePath("/recordatorios");
    revalidatePath("/appointments");
  }

  return result;
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
