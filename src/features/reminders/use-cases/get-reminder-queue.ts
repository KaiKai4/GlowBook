import "server-only";

import {
  getRemindableAppointments,
  type RemindableAppointment,
} from "@/features/appointments/use-cases/remindable-appointments";
import { getActiveEmployeeNameOptions } from "@/features/employees/use-cases/employee-name-options";
import { getActiveMessageTemplate } from "@/features/notifications/use-cases/active-message-template";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { addDaysToDateISO, formatLocalDateISO, utcBounds } from "@/infra/format/dates";
import { findLatestReminderLogsByAppointmentIds } from "../data/reminder-log.repo";
import type { ReminderAppointment, ReminderQueueViewModel } from "../view-models";

export interface GetReminderQueueInput {
  salonId: string;
  daysAhead?: number;
  now?: Date;
}

function toReminderAppointment(
  appointment: RemindableAppointment,
  latestReminder?: { sent_at: string; channel: string }
): ReminderAppointment {
  return {
    id: appointment.id,
    status: appointment.status,
    start_time: appointment.start_time,
    total_price: appointment.total_price,
    last_reminder_sent_at: latestReminder?.sent_at ?? null,
    last_reminder_channel: latestReminder?.channel ?? null,
    customer: appointment.customer
      ? {
          first_name: appointment.customer.first_name,
          last_name: appointment.customer.last_name,
          phone: appointment.customer.phone,
        }
      : null,
    items: appointment.items.map((item) => ({
      id: item.id,
      service: item.service ? { name: item.service.name } : null,
      employee: item.employee
        ? {
            id: item.employee.id,
            first_name: item.employee.first_name,
            last_name: item.employee.last_name,
          }
        : null,
    })),
  };
}

export async function getReminderQueue({
  salonId,
  daysAhead = 7,
  now = new Date(),
}: GetReminderQueueInput): Promise<ReminderQueueViewModel> {
  const salon = await getSalonIdentity(salonId);
  const timezone = salon?.timezone ?? "America/Panama";
  const localToday = formatLocalDateISO(now, timezone);
  const { start, end } = utcBounds(localToday, addDaysToDateISO(localToday, daysAhead), timezone);

  const [appointments, reminderTemplate, employees] = await Promise.all([
    getRemindableAppointments(salonId, { startDate: start, endDate: end }),
    getActiveMessageTemplate(salonId, "appointment_reminder"),
    getActiveEmployeeNameOptions(salonId),
  ]);
  const latestReminders = await findLatestReminderLogsByAppointmentIds(
    salonId,
    appointments.map((appointment) => appointment.id)
  );
  const pendingAppointments = appointments
    .map((appointment) => toReminderAppointment(
      appointment,
      latestReminders.get(appointment.id)
    ));

  return {
    appointments: pendingAppointments,
    employees,
    timezone,
    salonName: salon?.name ?? "tu salon",
    template: reminderTemplate.bodyText,
    templateId: reminderTemplate.id,
  };
}
