import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SalonSettings {
  id: string;
  name: string;
  timezone: string;
  theme: string;
  bg_style: string | null;
}

export interface BusinessHourRow {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export async function findSalonSettings(salonId: string): Promise<SalonSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salons")
    .select("id, name, timezone, theme, bg_style")
    .eq("id", salonId)
    .single();
  return data ?? null;
}

export async function findBusinessHours(salonId: string): Promise<BusinessHourRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salon_business_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("salon_id", salonId)
    .order("day_of_week", { ascending: true });
  return data ?? [];
}
