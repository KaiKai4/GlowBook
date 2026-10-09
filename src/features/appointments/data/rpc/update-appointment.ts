import "server-only";

import { toCanonicalPayload } from "@/lib/idempotency/canonical-json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorMessageOf } from "./error-message";
import type { CreateAppointmentRpcPayload } from "./create-appointment";

export interface UpdateAppointmentRpcPayload {
  appointment_id: string;
  notes: string;
  items: CreateAppointmentRpcPayload["items"];
}

export interface UpdateAppointmentRpcInput {
  payload: UpdateAppointmentRpcPayload;
  /** Clave de idempotencia (uuid): un reintento con la misma clave no vuelve a reemplazar los items. */
  idempotencyKey: string;
}

export interface UpdateAppointmentRpcResult {
  ok: boolean;
  errorMessage?: string;
}

/** Reemplaza los items de la cita (agenda) en una transaccion. Los fallos llegan como ok:false. */
export async function updateAppointmentWithRpc(
  input: UpdateAppointmentRpcInput
): Promise<UpdateAppointmentRpcResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const payload = toCanonicalPayload({
      ...input.payload,
      idempotency_key: input.idempotencyKey,
    });
    const { error } = await supabase.rpc("update_appointment", { payload });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, errorMessage: errorMessageOf(error) };
  }
}
