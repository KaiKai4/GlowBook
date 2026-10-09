"use server";

import { revalidatePath } from "next/cache";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { parseUuid } from "@/lib/validation/route-id";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { recordManualReminder } from "@/features/reminders/use-cases/record-manual-reminder";
import type { Result } from "@/lib/result";

export async function markReminderSentAction(
  appointmentId: string,
  templateId?: string
): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  const remindersEnabled = await isEffectiveSalonModuleEnabled(profile, "recordatorios");

  if (!remindersEnabled || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para enviar recordatorios." };
  }

  const limited = await assertActionRateLimit(profile.id, "recordatorios-envio", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;
  if (!parseUuid(appointmentId)) return { ok: false, error: "Identificador inválido." };
  if (templateId !== undefined && !parseUuid(templateId)) {
    return { ok: false, error: "Identificador inválido." };
  }

  const result = await recordManualReminder({
    salonId: profile.salon_id,
    appointmentId,
    templateId,
    userId: profile.id,
  });

  if (result.ok) revalidatePath("/recordatorios");
  return result;
}

export async function confirmReminderAppointmentAction(
  appointmentId: string
): Promise<Result<void>> {
  const profile = await requireActiveProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para confirmar citas." };
  }

  const limited = await assertActionRateLimit(profile.id, "recordatorios-confirmar", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;
  if (!parseUuid(appointmentId)) return { ok: false, error: "Identificador inválido." };

  const result = await confirmAppointment(appointmentId, profile.salon_id);

  if (result.ok) {
    revalidatePath("/recordatorios");
    revalidatePath("/appointments");
  }

  return result;
}
