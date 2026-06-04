import "server-only";

import { findAppointmentById } from "../data/appointments.repo";

export interface AppointmentReminderTarget {
  salonId: string;
  customerPhone?: string;
}

export async function getAppointmentReminderTarget(
  appointmentId: string
): Promise<AppointmentReminderTarget | null> {
  const appointment = await findAppointmentById(appointmentId);
  if (!appointment) return null;

  return {
    salonId: appointment.salon_id,
    customerPhone: appointment.customer?.phone ?? undefined,
  };
}
