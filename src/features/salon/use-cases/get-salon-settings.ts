import "server-only";

import { findBusinessHours, findSalonSettings } from "../data/salon.repo";

export interface SalonBusinessDay {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

export interface SalonSettingsViewModel {
  salonName: string;
  timezone: string;
  theme: string;
  bgStyle: string;
  businessHours: SalonBusinessDay[];
}

// Stored time columns come back as "HH:MM:SS"; UI inputs expect "HH:MM".
function toHHMM(value: string | null, fallback: string): string {
  return value ? value.slice(0, 5) : fallback;
}

export async function getSalonSettings(salonId: string): Promise<SalonSettingsViewModel> {
  const [salon, hours] = await Promise.all([
    findSalonSettings(salonId),
    findBusinessHours(salonId),
  ]);

  const byDay = new Map(hours.map((hour) => [hour.day_of_week, hour]));
  const businessHours: SalonBusinessDay[] = Array.from({ length: 7 }, (_, day) => {
    const row = byDay.get(day);
    return {
      day_of_week: day,
      is_open: row?.is_open ?? false,
      open_time: toHHMM(row?.open_time ?? null, "09:00"),
      close_time: toHHMM(row?.close_time ?? null, "18:00"),
    };
  });

  return {
    salonName: salon?.name ?? "",
    timezone: salon?.timezone ?? "America/Panama",
    theme: salon?.theme ?? "violet",
    bgStyle: salon?.bg_style ?? "neutral",
    businessHours,
  };
}
