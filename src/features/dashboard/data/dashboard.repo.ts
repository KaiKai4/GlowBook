import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";

type RelatedOne<T> = T | T[] | null;

export interface DashboardPendingConfirmationRow {
  id: string;
  start_time: string | null;
  customer: RelatedOne<{
    first_name: string;
    last_name: string;
    phone: string | null;
  }>;
}

export async function findPendingConfirmationRows(
  salonId: string,
  from: string,
  limit = 6
): Promise<DashboardPendingConfirmationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, customer:customers(first_name, last_name, phone)")
    .eq("salon_id", salonId)
    .eq("status", "scheduled")
    .gte("start_time", from)
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as DashboardPendingConfirmationRow[];
}
