"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { revalidatePath } from "next/cache";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { updateMessageTemplate } from "@/features/notifications/use-cases/update-message-template";
import { parseNotificationTemplateInput } from "@/features/notifications/use-cases/template-input";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import type { Result } from "@/infra/result";

// Se conserva el guard a mano: el modulo de plantillas del plan se comprueba
// antes del limite de peticiones (y defineAction solo sabe de permisos por clave).
// La validacion de la plantilla vive en features/notifications/use-cases.
export async function updateNotificationTemplateAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const templatesEnabled = await isEffectiveSalonModuleEnabled(profile, "plantillas");
  if (!templatesEnabled || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para editar plantillas." };
  }

  const limited = await assertActionRateLimit(profile.id, "plantillas", RATE_LIMIT_POLICIES.restricted);
  if (!limited.ok) return limited;

  const parsed = parseNotificationTemplateInput({
    event: formData.get("event"),
    body_text: formData.get("body_text"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.ok) return parsed;

  const result = await updateMessageTemplate(profile.salon_id, parsed.value);
  if (result.ok) {
    revalidatePath("/plantillas");
    revalidatePath("/recordatorios");
    revalidatePath("/appointments");
  }

  return result;
}
