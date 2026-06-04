import "server-only";

import type { NotificationTemplateEvent } from "../domain/templates";
import { findActiveMessageTemplate } from "../data/notification-templates.repo";

export interface ActiveMessageTemplateView {
  id?: string;
  bodyText: string;
}

export async function getActiveMessageTemplate(
  salonId: string,
  event: NotificationTemplateEvent
): Promise<ActiveMessageTemplateView> {
  const template = await findActiveMessageTemplate(salonId, event);

  return {
    id: template.id,
    bodyText: template.body_text,
  };
}
