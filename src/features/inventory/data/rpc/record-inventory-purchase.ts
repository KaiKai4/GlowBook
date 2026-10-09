import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";

const RecordInventoryPurchaseResultSchema = z.string().uuid();

export interface RecordInventoryPurchaseRpcInput {
  salonId: string;
  /** Null cuando la compra no indica proveedor. */
  supplierName: string | null;
  purchaseDate: string;
  productId: string;
  quantity: number;
  unitCost: number;
  note: string | null;
  /** Clave de idempotencia (uuid). Un reintento con la misma clave devuelve la compra original. */
  idempotencyKey: string;
}

/**
 * Registra la compra, suma stock y genera el gasto de inventario en una transaccion.
 * Devuelve el id de la compra. El proveedor nulo se pasa con un cast acotado: la base lo
 * acepta, pero los tipos generados lo declaran string requerido.
 */
export async function recordInventoryPurchaseRpc(input: RecordInventoryPurchaseRpcInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const response = await supabase.rpc("record_inventory_purchase", {
    p_salon_id: input.salonId,
    p_supplier_name: input.supplierName as string,
    p_purchase_date: input.purchaseDate,
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost,
    p_note: input.note ?? undefined,
    p_idempotency_key: input.idempotencyKey,
  });
  return parseRpcResponse("record_inventory_purchase", response, RecordInventoryPurchaseResultSchema);
}
