import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { NotificationTemplateSchema, type NotificationTemplateInput } from "../schemas";

export interface NotificationTemplateRaw {
  event: unknown;
  body_text: unknown;
  is_active: boolean;
}

// Valida la plantilla de mensaje antes de guardarla. Sin I/O.
export function parseNotificationTemplateInput(raw: NotificationTemplateRaw): Result<NotificationTemplateInput> {
  const parsed = NotificationTemplateSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(firstIssueMessage(parsed.error));
}
