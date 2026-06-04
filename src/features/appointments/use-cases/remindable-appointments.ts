import "server-only";

import {
  findAppointmentsBySalon,
  type AppointmentWithDetails,
} from "../data/appointments.repo";

export type RemindableAppointment = Pick<
  AppointmentWithDetails,
  "id" | "status" | "start_time" | "total_price" | "customer" | "items"
>;

export interface RemindableAppointmentsRange {
  startDate: string;
  endDate: string;
}

const REMINDABLE_STATUSES = new Set(["scheduled", "confirmed"]);

export async function getRemindableAppointments(
  salonId: string,
  range: RemindableAppointmentsRange
): Promise<RemindableAppointment[]> {
  const appointments = await findAppointmentsBySalon(salonId, range);

  return appointments.filter((appointment) => REMINDABLE_STATUSES.has(appointment.status));
}
