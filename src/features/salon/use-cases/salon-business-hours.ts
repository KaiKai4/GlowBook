import "server-only";

import type { BusinessHour } from "@/features/appointments/domain/types";
import { findBusinessHours } from "../data/salon.repo";

export async function getSalonBusinessHours(salonId: string): Promise<BusinessHour[]> {
  const businessHours = await findBusinessHours(salonId);

  return businessHours.map((hours) => ({
    day_of_week: hours.day_of_week,
    is_open: hours.is_open,
    open_time: hours.open_time,
    close_time: hours.close_time,
  }));
}
