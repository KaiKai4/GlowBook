import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { InventoryLocation } from "../domain/stock";

interface InventoryStockRow {
  id: string;
  salon_id: string;
  product_id: string;
  location: InventoryLocation;
  quantity: number | string;
  minimum_quantity: number | string;
}

export interface InventoryProductRow {
  id: string;
  salon_id: string;
  name: string;
  category: string | null;
  cost_price: number | string;
  sale_price: number | string;
  is_retail_enabled: boolean;
  is_active: boolean;
  deleted_at?: string | null;
  inventory_stock_locations?: InventoryStockRow[];
}

export interface InventoryMovementRow {
  id: string;
  salon_id: string;
  product_id: string;
  location: InventoryLocation;
  movement_type: string;
  quantity_delta: number | string;
  quantity_after: number | string;
  note: string | null;
  created_at: string;
  product?: { name: string } | { name: string }[] | null;
}

export interface InventoryPurchaseHistoryRow {
  id: string;
  purchase_date: string;
  total_cost: number | string;
  supplier_name: string | null;
  note: string | null;
  created_at: string;
  inventory_purchase_items?: Array<{
    quantity: number | string;
    unit_cost: number | string;
    total_cost: number | string;
    product?: { name: string } | { name: string }[] | null;
  }>;
}

export async function findInventoryProducts(salonId: string): Promise<InventoryProductRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_products")
    .select("*, inventory_stock_locations(*)")
    .eq("salon_id", salonId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as InventoryProductRow[];
}

export async function findRecentInventoryMovements(
  salonId: string,
  limit = 8
): Promise<InventoryMovementRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, product:inventory_products(name)")
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as InventoryMovementRow[];
}

export async function softDeleteInventoryProduct(productId: string, salonId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("inventory_products")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("salon_id", salonId);

  if (error) throw error;
}

export async function findInventoryPurchaseHistory(
  salonId: string,
  limit = 80
): Promise<InventoryPurchaseHistoryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_purchases")
    .select(
      "id, purchase_date, total_cost, supplier_name, note, created_at, inventory_purchase_items(quantity, unit_cost, total_cost, product:inventory_products(name))"
    )
    .eq("salon_id", salonId)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as InventoryPurchaseHistoryRow[];
}
