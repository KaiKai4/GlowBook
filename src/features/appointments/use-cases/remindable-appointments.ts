import "server-only";

import {
  findAppointmentsBySalon,
  type AppointmentWithDetails,
} from "../data/appointments.repo";
import { REMINDABLE_APPOINTMENT_STATUSES } from "../domain/lifecycle";

export type RemindableAppointment = Pick<
  AppointmentWithDetails,
  "id" | "status" | "start_time" | "total_price" | "customer" | "items"
>;

export interface RemindableAppointmentsRange {
  startDate: string;
  endDate: string;
}

const REMINDABLE_STATUSES: ReadonlySet<string> = new Set(REMINDABLE_APPOINTMENT_STATUSES);

export async function getRemindableAppointments(
  salonId: string,
  range: RemindableAppointmentsRange
): Promise<RemindableAppointment[]> {
  const appointments = await findAppointmentsBySalon(salonId, range);

  return appointments.filter((appointment) => REMINDABLE_STATUSES.has(appointment.status));
}
