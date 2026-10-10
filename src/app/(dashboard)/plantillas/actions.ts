"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import {
  parseNotificationTemplateInput,
  updateMessageTemplate,
  type NotificationTemplateInput,
} from "@/features/notifications";
import type { Result } from "@/infra/result";

// Edicion de la plantilla de recordatorios. El modulo de plantillas del plan se
// comprueba en el pipeline (antes del limite de peticiones); la validacion de la
// plantilla vive en features/notifications/use-cases.
const updateTemplateFlow = defineAction<FormData, NotificationTemplateInput, void>({
  module: "plantillas",
  permission: {
    key: PERMISSIONS.REMINDERS_SEND,
    deniedMessage: "No tienes permiso para editar plantillas.",
  },
  rateLimit: { scope: "plantillas", options: RATE_LIMIT_POLICIES.restricted },
  parse: (formData) =>
    parseNotificationTemplateInput({
      event: formData.get("event"),
      body_text: formData.get("body_text"),
      is_active: formData.get("is_active") === "on",
    }),
  run: (input, session) => updateMessageTemplate(session.salonId, input),
  revalidate: () => ["/plantillas", "/recordatorios", "/appointments"],
});

export async function updateNotificationTemplateAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return updateTemplateFlow(formData);
}
