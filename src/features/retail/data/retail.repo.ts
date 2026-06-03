import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InventoryLocation } from "@/features/inventory/domain/stock";

type AnySupabase = {
  from: (table: string) => QueryBuilder;
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

export async function insertRetailSale(
  salonId: string,
  input: {
    customer_id?: string | null;
    payment_method: string;
    total_amount: number;
    note?: string;
  }
): Promise<{ id: string }> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("retail_sales")
    .insert({
      salon_id: salonId,
      customer_id: input.customer_id || null,
      payment_method: input.payment_method,
      total_amount: input.total_amount,
      note: input.note || null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}

export async function insertRetailSaleItem(
  salonId: string,
  input: {
    sale_id: string;
    product_id: string;
    location: InventoryLocation;
    quantity: number;
    unit_price: number;
    total_price: number;
  }
): Promise<void> {
  const supabase = db(await createSupabaseServerClient());
  const { error } = await supabase.from("retail_sale_items").insert({
    salon_id: salonId,
    sale_id: input.sale_id,
    product_id: input.product_id,
    location: input.location,
    quantity: input.quantity,
    unit_price: input.unit_price,
    total_price: input.total_price,
  });

  if (error) throw error;
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
