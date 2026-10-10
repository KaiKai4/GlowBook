import "server-only";

import { toCanonicalPayload } from "@/infra/idempotency/canonical-json";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";

const CompleteAppointmentResultSchema = z.object({
  appointment_id: z.string().uuid(),
  status: z.literal("completed"),
  subtotal: z.number(),
  discount_amount: z.number(),
  total_price: z.number(),
});

/** Cobro de un item en la capa de aplicación (camelCase). El snake_case solo existe en el adaptador. */
interface CompleteAppointmentItemCharge {
  id: string;
  price: number;
  discountPercentage?: number;
}

export interface CompleteAppointmentRpcInput {
  appointmentId: string;
  paymentMethod: string;
  completionPriceNote?: string;
  itemCharges: CompleteAppointmentItemCharge[];
  /** Clave de idempotencia (uuid). Sin clave la RPC se ejecuta una sola vez por llamada. */
  idempotencyKey?: string;
}

export type CompleteAppointmentRpcResult = z.infer<typeof CompleteAppointmentResultSchema>;

/**
 * Completa la cita en una transaccion: precios y descuentos de los items, cabecera,
 * liberacion de la agenda y promocion del cliente temporal. Los totales los calcula la base.
 * Aqui se mapea el contrato camelCase de la aplicacion al JSON snake_case de la RPC.
 */
export async function completeAppointmentRpc(
  input: CompleteAppointmentRpcInput
): Promise<CompleteAppointmentRpcResult> {
  const supabase = await createSupabaseServerClient();
  const payload = toCanonicalPayload({
    appointment_id: input.appointmentId,
    payment_method: input.paymentMethod,
    completion_price_note: input.completionPriceNote ?? "",
    item_charges: input.itemCharges.map((charge) => ({
      id: charge.id,
      price: charge.price,
      discount_percentage: charge.discountPercentage ?? 0,
    })),
    idempotency_key: input.idempotencyKey,
  });
  const response = await supabase.rpc("complete_appointment", { payload });
  return parseRpcResponse("complete_appointment", response, CompleteAppointmentResultSchema);
}
