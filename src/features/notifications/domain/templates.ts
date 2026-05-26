export type NotificationTemplateEvent = "appointment_reminder" | "appointment_cancelled";

export interface MessageTemplate {
  id?: string;
  event: NotificationTemplateEvent;
  name: string;
  body_text: string;
  is_active: boolean;
}

export interface TemplateContext {
  cliente: string;
  fecha: string;
  hora: string;
  servicios: string;
  colaboradores: string;
  salon: string;
}

export const TEMPLATE_PLACEHOLDERS = [
  "{cliente}",
  "{fecha}",
  "{hora}",
  "{servicios}",
  "{colaboradores}",
  "{salon}",
] as const;

export const DEFAULT_MESSAGE_TEMPLATES: Record<NotificationTemplateEvent, MessageTemplate> = {
  appointment_reminder: {
    event: "appointment_reminder",
    name: "Recordatorio WhatsApp",
    is_active: true,
    body_text:
      "Hola {cliente}. Te recordamos que tienes una cita en {salon} el {fecha} a las {hora}.\n\nServicios: {servicios}\nProfesional: {colaboradores}\n\nSi necesitas reagendar, contáctanos. ¡Te esperamos!",
  },
  appointment_cancelled: {
    event: "appointment_cancelled",
    name: "Cancelación WhatsApp",
    is_active: true,
    body_text:
      "Hola {cliente}, lamentamos informarte que tu cita en {salon} para el {fecha} a las {hora} ha sido cancelada.\n\nServicios: {servicios}\n\nContáctanos para reagendar. ¡Gracias por tu comprensión!",
  },
};

export function renderMessageTemplate(template: string, context: TemplateContext): string {
  return TEMPLATE_PLACEHOLDERS.reduce((message, placeholder) => {
    const key = placeholder.slice(1, -1) as keyof TemplateContext;
    return message.replaceAll(placeholder, context[key] || "");
  }, template);
}
