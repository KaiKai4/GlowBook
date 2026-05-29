"use server";

import { revalidatePath } from "next/cache";
import { NotificationTemplateSchema } from "@/features/notifications/schemas";
import { updateMessageTemplate } from "@/features/notifications/use-cases/update-message-template";
import { hasPermission, hasSalonFeature, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import type { Result } from "@/lib/result";

export async function updateNotificationTemplateAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  if (!hasSalonFeature(profile, "plantillas") || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para editar plantillas." };
  }

  const parsed = NotificationTemplateSchema.safeParse({
    event: formData.get("event"),
    body_text: formData.get("body_text"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await updateMessageTemplate(profile.salon_id, parsed.data);
  if (result.ok) {
    revalidatePath("/plantillas");
    revalidatePath("/recordatorios");
    revalidatePath("/appointments");
  }

  return result;
}
