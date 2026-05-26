"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { upsertMessageTemplate } from "@/features/notifications/data/notification-templates.repo";
import { NotificationTemplateSchema, templateNameForEvent } from "@/features/notifications/schemas";
import type { Result } from "@/lib/result";

export async function updateNotificationTemplateAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para editar plantillas." };
  }

  const parsed = NotificationTemplateSchema.safeParse({
    event: formData.get("event"),
    body_text: formData.get("body_text"),
    is_active: formData.get("is_active") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await upsertMessageTemplate(profile.salon_id, {
      event: parsed.data.event,
      name: templateNameForEvent(parsed.data.event),
      body_text: parsed.data.body_text,
      is_active: parsed.data.is_active,
    });
  } catch (err) {
    console.error("[notifications] update template", err);
    return { ok: false, error: "No se pudo guardar la plantilla." };
  }

  revalidatePath("/plantillas");
  revalidatePath("/recordatorios");
  revalidatePath("/appointments");
  return { ok: true, value: undefined };
}
