import "server-only";

import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { findActiveEmployeeNames } from "@/features/employees/data/employees.repo";
import { findActiveMessageTemplate } from "@/features/notifications/data/notification-templates.repo";
import { findSalonIdentity } from "@/features/salon/data/salon.repo";
import { addDaysToDateISO, formatLocalDateISO, utcBounds } from "@/lib/utils/dates";
import { findLatestReminderLogsByAppointmentIds } from "../data/reminder-log.repo";
import type { ReminderAppointment, ReminderQueueViewModel } from "../view-models";

export interface GetReminderQueueInput {
  salonId: string;
  daysAhead?: number;
  now?: Date;
}

const REMINDABLE_STATUSES = new Set(["scheduled", "confirmed"]);

function toReminderAppointment(
  appointment: Awaited<ReturnType<typeof findAppointmentsBySalon>>[number],
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
  const salon = await findSalonIdentity(salonId);
  const timezone = salon?.timezone ?? "America/Panama";
  const localToday = formatLocalDateISO(now, timezone);
  const { start, end } = utcBounds(localToday, addDaysToDateISO(localToday, daysAhead), timezone);

  const [appointments, reminderTemplate, employees] = await Promise.all([
    findAppointmentsBySalon(salonId, { startDate: start, endDate: end }),
    findActiveMessageTemplate(salonId, "appointment_reminder"),
    findActiveEmployeeNames(salonId),
  ]);
  const remindableAppointments = appointments
    .filter((appointment) => REMINDABLE_STATUSES.has(appointment.status));
  const latestReminders = await findLatestReminderLogsByAppointmentIds(
    salonId,
    remindableAppointments.map((appointment) => appointment.id)
  );
  const pendingAppointments = remindableAppointments
    .map((appointment) => toReminderAppointment(
      appointment,
      latestReminders.get(appointment.id)
    ));

  return {
    appointments: pendingAppointments,
    employees: employees.map((employee) => ({
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
    })),
    timezone,
    salonName: salon?.name ?? "tu salon",
    template: reminderTemplate.body_text,
    templateId: reminderTemplate.id,
  };
}
