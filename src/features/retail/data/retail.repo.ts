import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InventoryLocation } from "@/features/inventory/domain/stock";

type AnySupabase = {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<QueryResult>;
};

type QueryResult = {
  data: unknown;
  error: Error | null;
  count?: number | null;
};

type QueryBuilder = PromiseLike<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  insert: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  single: (...args: unknown[]) => QueryBuilder;
};

function db(client: unknown): AnySupabase {
  return client as AnySupabase;
}

export interface RetailSaleRow {
  id: string;
  sale_date: string;
  total_amount: number | string;
  payment_method: string;
  note: string | null;
  customer?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
}

export async function recordRetailSaleAtomically(
  salonId: string,
  input: {
    customer_id?: string | null;
    product_id: string;
    location: InventoryLocation;
    quantity: number;
    unit_price: number;
    payment_method: string;
    note?: string;
  }
): Promise<{ id: string }> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("record_retail_sale", {
    p_salon_id: salonId,
    p_customer_id: input.customer_id || null,
    p_product_id: input.product_id,
    p_location: input.location,
    p_quantity: input.quantity,
    p_unit_price: input.unit_price,
    p_payment_method: input.payment_method,
    p_note: input.note || null,
  });

  if (error) throw error;
  return { id: String(data) };
}

export async function findRecentRetailSales(salonId: string, limit = 8): Promise<RetailSaleRow[]> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("retail_sales")
    .select("id, sale_date, total_amount, payment_method, note, customer:customers(first_name, last_name)")
    .eq("salon_id", salonId)
    .order("sale_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RetailSaleRow[];
}

export async function sumRetailSalesTotal(
  salonId: string,
  fromIso: string,
  toIso: string
): Promise<number> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("retail_sales")
    .select("total_amount")
    .eq("salon_id", salonId)
    .gte("sale_date", fromIso)
    .lte("sale_date", toIso);

  if (error) throw error;
  return ((data ?? []) as Array<{ total_amount: number | string }>).reduce((sum: number, row) => {
    return sum + Number(row.total_amount ?? 0);
  }, 0);
}
