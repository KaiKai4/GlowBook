"use server";

import { revalidatePath } from "next/cache";
import { NotificationTemplateSchema } from "@/features/notifications/schemas";
import { updateMessageTemplate } from "@/features/notifications/use-cases/update-message-template";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { requireActiveProfile } from "@/infra/auth/session";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import type { Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";

export async function updateNotificationTemplateAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const templatesEnabled = await isEffectiveSalonModuleEnabled(profile, "plantillas");
  if (!templatesEnabled || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para editar plantillas." };
  }

  const limited = await assertActionRateLimit(profile.id, "plantillas", { max: 30, windowMs: 60_000 });
  if (!limited.ok) return limited;

  const parsed = NotificationTemplateSchema.safeParse({
    event: formData.get("event"),
    body_text: formData.get("body_text"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await updateMessageTemplate(profile.salon_id, parsed.data);
  if (result.ok) {
    revalidatePath("/plantillas");
    revalidatePath("/recordatorios");
    revalidatePath("/appointments");
  }

  return result;
}
