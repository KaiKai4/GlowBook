import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { Database } from "@/types/database.types";

export interface BusinessHourRow {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export type UpsertBusinessHourRow =
  Database["public"]["Tables"]["salon_business_hours"]["Insert"];

export async function findBusinessHours(salonId: string): Promise<BusinessHourRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salon_business_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("salon_id", salonId)
    .order("day_of_week", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertBusinessHours(rows: UpsertBusinessHourRow[]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salon_business_hours")
    .upsert(rows, { onConflict: "salon_id,day_of_week" });

  if (error) throw error;
}
