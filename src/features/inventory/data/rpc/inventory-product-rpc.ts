import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";

const CreateInventoryProductResultSchema = z.string().uuid();

interface InventoryStockQuantities {
  retailQuantity: number;
  retailMinimum: number;
  internalQuantity: number;
  internalMinimum: number;
  storageQuantity: number;
  storageMinimum: number;
}

export interface CreateInventoryProductRpcInput extends InventoryStockQuantities {
  salonId: string;
  name: string;
  /** Null cuando la categoria viene vacia. */
  category: string | null;
  costPrice: number;
  salePrice: number;
  isRetailEnabled: boolean;
}

export interface UpdateInventoryProductRpcInput {
  salonId: string;
  productId: string;
  name: string;
  category: string | null;
  costPrice: number;
  salePrice: number;
  isRetailEnabled: boolean;
  isActive: boolean;
  retailMinimum: number;
  internalMinimum: number;
  storageMinimum: number;
}

/**
 * Crea el producto, sus tres ubicaciones de stock y los movimientos de stock inicial en una
 * transaccion. Devuelve el id del producto.
 */
export async function createInventoryProductWithStockRpc(input: CreateInventoryProductRpcInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const response = await supabase.rpc("create_inventory_product_with_stock", {
    p_salon_id: input.salonId,
    p_name: input.name,
    p_category: input.category ?? "",
    p_cost_price: input.costPrice,
    p_sale_price: input.salePrice,
    p_is_retail_enabled: input.isRetailEnabled,
    p_retail_quantity: input.retailQuantity,
    p_retail_minimum: input.retailMinimum,
    p_internal_quantity: input.internalQuantity,
    p_internal_minimum: input.internalMinimum,
    p_storage_quantity: input.storageQuantity,
    p_storage_minimum: input.storageMinimum,
  });
  return parseRpcResponse("create_inventory_product_with_stock", response, CreateInventoryProductResultSchema);
}

/** Actualiza el producto y los minimos de sus tres ubicaciones en una transaccion. */
export async function updateInventoryProductProfileRpc(input: UpdateInventoryProductRpcInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_inventory_product_profile", {
    p_salon_id: input.salonId,
    p_product_id: input.productId,
    p_name: input.name,
    p_category: input.category ?? "",
    p_cost_price: input.costPrice,
    p_sale_price: input.salePrice,
    p_is_retail_enabled: input.isRetailEnabled,
    p_is_active: input.isActive,
    p_retail_minimum: input.retailMinimum,
    p_internal_minimum: input.internalMinimum,
    p_storage_minimum: input.storageMinimum,
  });

  if (error) throw error;
}
