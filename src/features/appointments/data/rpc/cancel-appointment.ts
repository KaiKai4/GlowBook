import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { callIdempotentRpc } from "@/infra/supabase/call-idempotent-rpc";
import { z } from "@/infra/validation/zod";

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
  return callIdempotentRpc(supabase, "cancel_appointment", {
    appointment_id: input.appointmentId,
    idempotency_key: input.idempotencyKey,
  }, CancelAppointmentResultSchema);
}
