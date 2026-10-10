import { captureError } from "@/infra/observability";
import { toPublicErrorMessage } from "@/infra/errors";
import "server-only";

import type { Result } from "@/infra/result";
import { upsertMessageTemplate } from "../data/notification-templates.repo";
import type { NotificationTemplateInput } from "../schemas";
import { templateNameForEvent } from "../schemas";

export async function updateMessageTemplate(
  salonId: string,
  input: NotificationTemplateInput
): Promise<Result<void>> {
  try {
    await upsertMessageTemplate(salonId, {
      event: input.event,
      name: templateNameForEvent(input.event),
      body_text: input.body_text,
      is_active: input.is_active,
    });

    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "notifications", action: "update_template" });
    return { ok: false, error: toPublicErrorMessage(error, "No se pudo guardar la plantilla.") };
  }
}
