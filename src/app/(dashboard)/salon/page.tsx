import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findSalonSettings, findBusinessHours } from "@/features/salon/data/salon.repo";
import { SalonSettings } from "./salon-settings";

export interface BusinessDay {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

// Stored time columns come back as "HH:MM:SS" — trim to "HH:MM" for <input type="time">.
function toHHMM(value: string | null, fallback: string): string {
  return value ? value.slice(0, 5) : fallback;
}

export default async function SalonSettingsPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.SALON_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para configurar el salón.</p>
      </div>
    );
  }

  const [salon, hours] = await Promise.all([
    findSalonSettings(profile.salon_id),
    findBusinessHours(profile.salon_id),
  ]);

  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  // Normalize to all 7 weekdays (0 = Monday … 6 = Sunday).
  const businessHours: BusinessDay[] = Array.from({ length: 7 }, (_, day) => {
    const row = byDay.get(day);
    return {
      day_of_week: day,
      is_open: row?.is_open ?? false,
      open_time: toHHMM(row?.open_time ?? null, "09:00"),
      close_time: toHHMM(row?.close_time ?? null, "18:00"),
    };
  });

  return (
    <SalonSettings
      salonName={salon?.name ?? ""}
      timezone={salon?.timezone ?? "America/Panama"}
      businessHours={businessHours}
    />
  );
}
