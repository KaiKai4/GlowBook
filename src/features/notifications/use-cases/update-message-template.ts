import "server-only";

import type { Result } from "@/lib/result";
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
  } catch {
    return { ok: false, error: "No se pudo guardar la plantilla." };
  }
}
