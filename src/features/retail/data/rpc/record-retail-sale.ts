import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseRpcResponse } from "@/lib/supabase/rpc-response";
import { z } from "@/lib/validation/zod";

const RecordRetailSaleResultSchema = z.string().uuid();

export interface RecordRetailSaleRpcInput {
  salonId: string;
  /** Null para venta de mostrador sin cliente. */
  customerId: string | null;
  productId: string;
  location: string;
  quantity: number;
  unitPrice: number;
  paymentMethod: string;
  note: string | null;
  /** Clave de idempotencia (uuid). Un reintento con la misma clave devuelve la venta original. */
  idempotencyKey: string;
}

/**
 * Registra la venta y descuenta stock en una sola transaccion. Devuelve el id de la venta.
 * La base acepta p_customer_id null (venta sin cliente); los tipos generados lo declaran
 * como string requerido, por eso el valor nulo se pasa con un cast acotado a este campo.
 */
export async function recordRetailSaleRpc(input: RecordRetailSaleRpcInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const response = await supabase.rpc("record_retail_sale", {
    p_salon_id: input.salonId,
    p_customer_id: input.customerId as string,
    p_product_id: input.productId,
    p_location: input.location,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
    p_payment_method: input.paymentMethod,
    p_note: input.note ?? undefined,
    p_idempotency_key: input.idempotencyKey,
  });
  return parseRpcResponse("record_retail_sale", response, RecordRetailSaleResultSchema);
}
