import { formatTimeTz } from "@/infra/format/dates";
import { renderMessageTemplate } from "@/features/notifications/domain/templates";
import type { ReminderAppointment } from "@/features/reminders/view-models";

export function localDateStr(isoStr: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(isoStr));
}

export function todayStr(tz: string): string {
  return localDateStr(new Date().toISOString(), tz);
}

export function tomorrowStr(tz: string): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDateStr(date.toISOString(), tz);
}

export function isSameLocalDay(left: string | null, right: string, tz: string): boolean {
  return !!left && localDateStr(left, tz) === right;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function formatSentAt(sentAt: string, tz: string): string {
  const date = new Date(sentAt);
  return `${date.toLocaleDateString("es-PA", {
    day: "numeric",
    month: "short",
    timeZone: tz,
  })} ${formatTimeTz(date, tz)}`;
}

export function customerName(appt: ReminderAppointment): string {
  return appt.customer ? `${appt.customer.first_name} ${appt.customer.last_name}` : "Sin cliente";
}

// Colaboradores sin repetir, separados por coma. Cadena vacía si la cita no tiene profesional asignado.
export function collaboratorNames(appt: ReminderAppointment): string {
  return [
    ...new Set(
      appt.items
        .map((item) => (item.employee ? `${item.employee.first_name} ${item.employee.last_name}` : null))
        .filter(Boolean)
    ),
  ].join(", ");
}

export function buildReminderMessage({
  appt,
  tz,
  salonName,
  template,
}: {
  appt: ReminderAppointment;
  tz: string;
  salonName: string;
  template: string;
}): string {
  const start = appt.start_time ? new Date(appt.start_time) : new Date();
  const dateLabel = start.toLocaleDateString("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  });
  const services =
    appt.items.map((item) => item.service?.name).filter(Boolean).join(", ") ||
    "Servicios de belleza";
  const collaborators = collaboratorNames(appt) || "nuestro equipo";

  return renderMessageTemplate(template, {
    cliente: appt.customer?.first_name ?? "cliente",
    fecha: dateLabel,
    hora: formatTimeTz(start, tz),
    servicios: services,
    colaboradores: collaborators,
    salon: salonName,
  });
}
