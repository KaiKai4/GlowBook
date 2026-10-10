import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { callIdempotentRpc } from "@/infra/supabase/call-idempotent-rpc";
import { z } from "@/infra/validation/zod";

const ConfirmAppointmentResultSchema = z.object({
  appointment_id: z.string().uuid(),
  status: z.literal("confirmed"),
});

export interface ConfirmAppointmentRpcInput {
  appointmentId: string;
  /** Clave de idempotencia (uuid). Sin clave la RPC se comporta como una llamada sin reintentos. */
  idempotencyKey?: string;
}

export type ConfirmAppointmentRpcResult = z.infer<typeof ConfirmAppointmentResultSchema>;

/** Transicion scheduled -> confirmed en la base (FOR UPDATE + guarda de estado). */
export async function confirmAppointmentRpc(
  input: ConfirmAppointmentRpcInput
): Promise<ConfirmAppointmentRpcResult> {
  const supabase = await createSupabaseServerClient();
  return callIdempotentRpc(supabase, "confirm_appointment", {
    appointment_id: input.appointmentId,
    idempotency_key: input.idempotencyKey,
  }, ConfirmAppointmentResultSchema);
}
