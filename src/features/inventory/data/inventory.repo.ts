import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InventoryLocation } from "../domain/stock";

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
  update: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  maybeSingle: (...args: unknown[]) => QueryBuilder;
  single: (...args: unknown[]) => QueryBuilder;
};

function db(client: unknown): AnySupabase {
  return client as AnySupabase;
}

export interface InventoryStockRow {
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
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("inventory_products")
    .select("*, inventory_stock_locations(*)")
    .eq("salon_id", salonId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as InventoryProductRow[];
}

export async function findLowStockProductCount(salonId: string): Promise<number> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("inventory_stock_locations")
    .select("product_id, quantity, minimum_quantity, product:inventory_products!inner(deleted_at)")
    .eq("salon_id", salonId)
    .is("product.deleted_at", null);

  if (error) throw error;

  const lowStockProductIds = new Set<string>();
  for (const row of (data ?? []) as InventoryStockRow[]) {
    const quantity = Number(row.quantity ?? 0);
    const minimumQuantity = Number(row.minimum_quantity ?? 0);
    if (quantity <= 0 || (minimumQuantity > 0 && quantity <= minimumQuantity)) {
      lowStockProductIds.add(row.product_id);
    }
  }

  return lowStockProductIds.size;
}

export async function findRecentInventoryMovements(
  salonId: string,
  limit = 8
): Promise<InventoryMovementRow[]> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, product:inventory_products(name)")
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as InventoryMovementRow[];
}

export async function insertInventoryProduct(
  salonId: string,
  input: {
    name: string;
    category?: string;
    cost_price: number;
    sale_price: number;
    is_retail_enabled: boolean;
  }
): Promise<InventoryProductRow> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("inventory_products")
    .insert({
      salon_id: salonId,
      name: input.name,
      category: input.category || null,
      cost_price: input.cost_price,
      sale_price: input.sale_price,
      is_retail_enabled: input.is_retail_enabled,
    })
    .select()
    .single();

  if (error) throw error;
  return data as InventoryProductRow;
}

export async function updateInventoryProduct(
  productId: string,
  salonId: string,
  input: {
    name: string;
    category?: string;
    cost_price: number;
    sale_price: number;
    is_retail_enabled: boolean;
    is_active: boolean;
  }
): Promise<void> {
  const supabase = db(await createSupabaseServerClient());
  const { error } = await supabase
    .from("inventory_products")
    .update({
      name: input.name,
      category: input.category || null,
      cost_price: input.cost_price,
      sale_price: input.sale_price,
      is_retail_enabled: input.is_retail_enabled,
      is_active: input.is_active,
    })
    .eq("id", productId)
    .eq("salon_id", salonId);

  if (error) throw error;
}

export async function softDeleteInventoryProduct(productId: string, salonId: string): Promise<void> {
  const supabase = db(await createSupabaseServerClient());
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

export async function insertStockLocations(
  salonId: string,
  productId: string,
  rows: Array<{
    location: InventoryLocation;
    quantity: number;
    minimum_quantity: number;
  }>
): Promise<InventoryStockRow[]> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("inventory_stock_locations")
    .insert(rows.map((row) => ({ ...row, salon_id: salonId, product_id: productId })))
    .select();

  if (error) throw error;
  return (data ?? []) as InventoryStockRow[];
}

export async function updateStockMinimums(
  salonId: string,
  productId: string,
  rows: Array<{ location: InventoryLocation; minimum_quantity: number }>
): Promise<void> {
  const supabase = db(await createSupabaseServerClient());

  for (const row of rows) {
    const { error } = await supabase
      .from("inventory_stock_locations")
      .update({ minimum_quantity: row.minimum_quantity })
      .eq("salon_id", salonId)
      .eq("product_id", productId)
      .eq("location", row.location);

    if (error) throw error;
  }
}

export async function insertInventoryMovement(
  salonId: string,
  input: {
    product_id: string;
    location: InventoryLocation;
    movement_type: string;
    quantity_delta: number;
    quantity_after: number;
    reference_type?: string;
    reference_id?: string;
    note?: string;
  }
): Promise<void> {
  const supabase = db(await createSupabaseServerClient());
  const { error } = await supabase.from("inventory_movements").insert({
    salon_id: salonId,
    product_id: input.product_id,
    location: input.location,
    movement_type: input.movement_type,
    quantity_delta: input.quantity_delta,
    quantity_after: input.quantity_after,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    note: input.note || null,
  });

  if (error) throw error;
}

export async function applyInventoryStockDelta(
  salonId: string,
  input: {
    product_id: string;
    location: InventoryLocation;
    delta: number;
    movement_type: string;
    reference_type?: string;
    reference_id?: string;
    note?: string;
  }
): Promise<{ quantityAfter: number }> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("apply_inventory_stock_delta", {
    p_salon_id: salonId,
    p_product_id: input.product_id,
    p_location: input.location,
    p_delta: input.delta,
    p_movement_type: input.movement_type,
    p_reference_type: input.reference_type ?? null,
    p_reference_id: input.reference_id ?? null,
    p_note: input.note || null,
  });

  if (error) throw error;
  return { quantityAfter: Number(data ?? 0) };
}

export async function transferInventoryStockAtomically(
  salonId: string,
  input: {
    product_id: string;
    from_location: InventoryLocation;
    to_location: InventoryLocation;
    quantity: number;
    note?: string;
  }
): Promise<void> {
  const supabase = db(await createSupabaseServerClient());
  const { error } = await supabase.rpc("record_inventory_transfer", {
    p_salon_id: salonId,
    p_product_id: input.product_id,
    p_from_location: input.from_location,
    p_to_location: input.to_location,
    p_quantity: input.quantity,
    p_note: input.note || null,
  });

  if (error) throw error;
}

export async function recordInventoryPurchaseAtomically(
  salonId: string,
  input: {
    supplier_name?: string;
    purchase_date: string;
    product_id: string;
    quantity: number;
    unit_cost: number;
    note?: string;
  }
): Promise<{ id: string }> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("record_inventory_purchase", {
    p_salon_id: salonId,
    p_supplier_name: input.supplier_name || null,
    p_purchase_date: input.purchase_date,
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_unit_cost: input.unit_cost,
    p_note: input.note || null,
  });

  if (error) throw error;
  return { id: String(data) };
}

export async function sumInventoryPurchasesTotal(
  salonId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("inventory_purchases")
    .select("total_cost")
    .eq("salon_id", salonId)
    .gte("purchase_date", fromDate)
    .lte("purchase_date", toDate);

  if (error) throw error;
  return ((data ?? []) as Array<{ total_cost: number | string }>).reduce((sum: number, row) => {
    return sum + Number(row.total_cost ?? 0);
  }, 0);
}

export async function findInventoryPurchaseHistory(
  salonId: string,
  limit = 80
): Promise<InventoryPurchaseHistoryRow[]> {
  const supabase = db(await createSupabaseServerClient());
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
