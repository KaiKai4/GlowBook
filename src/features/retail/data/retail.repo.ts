import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface RetailSaleRow {
  id: string;
  sale_date: string;
  total_amount: number | string;
  payment_method: string;
  note: string | null;
  customer?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
}

export async function findRecentRetailSales(salonId: string, limit = 8): Promise<RetailSaleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("retail_sales")
    .select("id, sale_date, total_amount, payment_method, note, customer:customers(first_name, last_name)")
    .eq("salon_id", salonId)
    .order("sale_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RetailSaleRow[];
}
