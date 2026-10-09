import { z } from "@/lib/validation/zod";
import { DEFAULT_MESSAGE_TEMPLATES } from "./domain/templates";

export const NotificationTemplateSchema = z.object({
  event: z.enum(["appointment_reminder", "appointment_cancelled"]),
  body_text: z.string().trim().min(10, "La plantilla debe tener al menos 10 caracteres."),
  is_active: z.boolean(),
});

export type NotificationTemplateInput = z.infer<typeof NotificationTemplateSchema>;

export function templateNameForEvent(event: NotificationTemplateInput["event"]): string {
  return DEFAULT_MESSAGE_TEMPLATES[event].name;
}
