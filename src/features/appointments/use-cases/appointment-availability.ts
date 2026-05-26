import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUtcDayBoundaries } from "@/lib/utils/dates";

export type OccupiedByEmployee = Record<string, { start_time: string; end_time: string }[]>;

// Returns blocking appointment slots grouped by employee for a salon-local date.
// `date` is a YYYY-MM-DD string representing a calendar day in the salon timezone.
export async function getOccupiedSlotsForSalonDate(
  salonId: string,
  date: string
): Promise<OccupiedByEmployee> {
  const supabase = await createSupabaseServerClient();

  const { data: salonData } = await supabase
    .from("salons")
    .select("timezone")
    .eq("id", salonId)
    .single();

  const timezone = salonData?.timezone ?? "UTC";

  // Noon UTC on the given date is within 12 hours of local midnight, so a single
  // adjustment always lands on the requested local day for any IANA timezone.
  let probe = new Date(`${date}T12:00:00.000Z`);
  const probeLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(probe);
  if (probeLocal !== date) {
    const delta = probeLocal > date ? -12 : 12;
    probe = new Date(probe.getTime() + delta * 60 * 60_000);
  }

  const { start: dayStart, end: dayEnd } = getUtcDayBoundaries(probe, timezone);

  const { data } = await supabase
    .from("appointment_items")
    .select("employee_id, start_time, end_time")
    .eq("salon_id", salonId)
    .eq("blocks_calendar", true)
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString());

  const map: OccupiedByEmployee = {};
  for (const item of data ?? []) {
    (map[item.employee_id] ??= []).push({
      start_time: item.start_time,
      end_time: item.end_time,
    });
  }

  return map;
}
