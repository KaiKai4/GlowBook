"use server";

import { revalidatePath } from "next/cache";
import { hasPermission, hasSalonFeature, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { recordManualReminder } from "@/features/reminders/use-cases/record-manual-reminder";
import type { Result } from "@/lib/result";

export async function markReminderSentAction(
  appointmentId: string,
  templateId?: string
): Promise<Result<string>> {
  const profile = await requireActiveProfile();

  if (!hasSalonFeature(profile, "recordatorios") || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para enviar recordatorios." };
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
