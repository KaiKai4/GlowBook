import "server-only";

import { toCanonicalPayload } from "@/lib/idempotency/canonical-json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseRpcResponse } from "@/lib/supabase/rpc-response";
import { z } from "@/lib/validation/zod";

const CancelAppointmentResultSchema = z.object({
  appointment_id: z.string().uuid(),
  status: z.literal("cancelled"),
});

export interface CancelAppointmentRpcInput {
  appointmentId: string;
  /** Clave de idempotencia (uuid). Sin clave la RPC se ejecuta una sola vez por llamada. */
  idempotencyKey?: string;
}

export type CancelAppointmentRpcResult = z.infer<typeof CancelAppointmentResultSchema>;

/** Cierre a "cancelled" y liberacion de la agenda en una sola transaccion. */
export async function cancelAppointmentRpc(
  input: CancelAppointmentRpcInput
): Promise<CancelAppointmentRpcResult> {
  const supabase = await createSupabaseServerClient();
  const payload = toCanonicalPayload({
    appointment_id: input.appointmentId,
    idempotency_key: input.idempotencyKey,
  });
  const response = await supabase.rpc("cancel_appointment", { payload });
  return parseRpcResponse("cancel_appointment", response, CancelAppointmentResultSchema);
}
