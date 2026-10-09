import "server-only";

import { toCanonicalPayload } from "@/lib/idempotency/canonical-json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseRpcResponse } from "@/lib/supabase/rpc-response";
import { z } from "@/lib/validation/zod";

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
  const payload = toCanonicalPayload({
    appointment_id: input.appointmentId,
    idempotency_key: input.idempotencyKey,
  });
  const response = await supabase.rpc("confirm_appointment", { payload });
  return parseRpcResponse("confirm_appointment", response, ConfirmAppointmentResultSchema);
}
