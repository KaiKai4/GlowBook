import "server-only";

import { findMessageTemplates } from "../data/notification-templates.repo";
import type { MessageTemplate } from "../domain/templates";

export interface TemplateSettingsViewModel {
  templates: MessageTemplate[];
}

export async function getTemplateSettings(salonId: string): Promise<TemplateSettingsViewModel> {
  return {
    templates: await findMessageTemplates(salonId),
  };
}
