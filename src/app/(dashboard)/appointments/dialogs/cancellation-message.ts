import { formatWeekdayDayMonth } from "@/infra/format/es-formats";
import { formatTimeTz } from "@/infra/format/dates";
import { renderMessageTemplate } from "@/features/notifications/domain/templates";

/** Datos de la cita necesarios para rellenar el texto de cancelación. */
export interface CancellationAppointment {
  start_time: string | null;
  customer: { first_name: string; phone: string | null } | null;
  items?: Array<{
    service: { name: string } | null;
    employee: { first_name: string; last_name: string } | null;
  }>;
}

/** Texto de la plantilla de cancelación rellenado con los datos de la cita. */
export function buildCancellationMessage({
  appt,
  template,
  salonName,
  tz,
}: {
  appt: CancellationAppointment;
  template: string;
  salonName: string;
  tz: string;
}): string {
  const customerFirstName = appt.customer?.first_name ?? "";
  const apptDate = appt.start_time
    ? formatWeekdayDayMonth(new Date(appt.start_time), { weekday: "long", month: "long", timeZone: tz })
    : "la fecha programada";
  const apptTime = appt.start_time
    ? formatTimeTz(new Date(appt.start_time), tz)
    : "la hora programada";

  const services =
    appt.items?.map((it) => it.service?.name).filter(Boolean).join(", ") || "Servicios de belleza";
  const collaborators =
    [...new Set(
      appt.items
        ?.map((it) => (it.employee ? `${it.employee.first_name} ${it.employee.last_name}` : null))
        .filter(Boolean) ?? []
    )].join(", ") || "nuestro equipo";

  return renderMessageTemplate(template, {
    cliente: customerFirstName,
    fecha: apptDate,
    hora: apptTime,
    servicios: services,
    colaboradores: collaborators,
    salon: salonName,
  });
}
