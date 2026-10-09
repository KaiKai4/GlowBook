import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { InventoryLocation } from "../../domain/stock";

export interface RecordInventoryTransferRpcInput {
  salonId: string;
  productId: string;
  fromLocation: InventoryLocation;
  toLocation: InventoryLocation;
  quantity: number;
  note: string | null;
  /** Clave de idempotencia (uuid). Un reintento con la misma clave no vuelve a mover stock. */
  idempotencyKey: string;
}

/** Mueve stock entre ubicaciones en una sola transaccion (la RPC no devuelve datos). */
export async function recordInventoryTransferRpc(input: RecordInventoryTransferRpcInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_inventory_transfer", {
    p_salon_id: input.salonId,
    p_product_id: input.productId,
    p_from_location: input.fromLocation,
    p_to_location: input.toLocation,
    p_quantity: input.quantity,
    p_note: input.note ?? undefined,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw error;
}
