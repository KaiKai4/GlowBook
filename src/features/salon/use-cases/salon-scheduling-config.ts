import "server-only";

import { findAppointmentSalonConfig, findBusinessHours } from "../data/salon.repo";
import type { SalonBusinessHour } from "./salon-business-hours";

// Forma estructural de la configuracion de agenda: la consume el modulo
// appointments sin que salon dependa de appointments (evita el ciclo).
export interface SalonSchedulingConfig {
  salonConfig: {
    min_booking_notice_minutes: number;
    min_appointment_duration_minutes: number;
    allow_off_hours_bookings: boolean;
    timezone: string;
  };
  businessHours: SalonBusinessHour[];
}

export async function getSalonSchedulingConfig(salonId: string): Promise<SalonSchedulingConfig> {
  const [salonConfig, businessHours] = await Promise.all([
    findAppointmentSalonConfig(salonId),
    findBusinessHours(salonId),
  ]);

  return {
    salonConfig: {
      min_booking_notice_minutes: salonConfig?.min_booking_notice_minutes ?? 0,
      min_appointment_duration_minutes: salonConfig?.min_appointment_duration_minutes ?? 30,
      allow_off_hours_bookings: salonConfig?.allow_off_hours_bookings ?? false,
      timezone: salonConfig?.timezone ?? "America/Panama",
    },
    businessHours: businessHours.map((hours) => ({
      day_of_week: hours.day_of_week,
      is_open: hours.is_open,
      open_time: hours.open_time,
      close_time: hours.close_time,
    })),
  };
}
