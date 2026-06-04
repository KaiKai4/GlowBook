import "server-only";

import type { BusinessHour, SalonConfig } from "@/features/appointments/domain/types";
import { findAppointmentSalonConfig, findBusinessHours } from "../data/salon.repo";

export interface SalonSchedulingConfig {
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
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
