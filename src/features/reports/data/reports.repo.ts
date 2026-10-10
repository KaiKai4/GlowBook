import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";

export interface SalonReportIdentity {
  name: string;
  timezone: string | null;
  created_at: string;
}

/** Identidad para reportes: el created_at acota el rango de años consultables. */
export async function findSalonReportIdentity(
  salonId: string
): Promise<SalonReportIdentity | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salons")
    .select("name, timezone, created_at")
    .eq("id", salonId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
