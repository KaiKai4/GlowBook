import "server-only";

import { findBusinessHours } from "../data/salon.repo";

/** Horario de apertura del salon por dia (0=Lunes ... 6=Domingo). */
export interface SalonBusinessHour {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export async function getSalonBusinessHours(salonId: string): Promise<SalonBusinessHour[]> {
  const businessHours = await findBusinessHours(salonId);

  return businessHours.map((hours) => ({
    day_of_week: hours.day_of_week,
    is_open: hours.is_open,
    open_time: hours.open_time,
    close_time: hours.close_time,
  }));
}
