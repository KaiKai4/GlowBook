import "server-only";

import { toCanonicalPayload } from "@/infra/idempotency/canonical-json";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";
import { errorMessageOf } from "./error-message";

const CreateAppointmentResultSchema = z.string().uuid();

/** Cliente nuevo que la RPC da de alta en la misma transaccion (alta temporal o cliente con ese telefono). */
interface CreateAppointmentRpcNewCustomer {
  first_name: string;
  last_name: string;
  phone?: string;
}

/** Exactamente uno de customer_id o new_customer (la RPC rechaza ambos o ninguno). */
export interface CreateAppointmentRpcPayload {
  salon_id: string;
  customer_id?: string;
  new_customer?: CreateAppointmentRpcNewCustomer;
  created_by: string;
  notes: string;
  items: Array<{
    salon_id: string;
    service_id: string;
    employee_id: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    price: number;
    ordering: number;
    blocks_calendar: boolean;
  }>;
}

export interface CreateAppointmentRpcInput {
  payload: CreateAppointmentRpcPayload;
  /** Clave de idempotencia (uuid): un reintento con la misma clave devuelve la cita original. */
  idempotencyKey: string;
}

export interface CreateAppointmentRpcResult {
  ok: boolean;
  appointmentId?: string;
  errorMessage?: string;
}

/** Crea la cita y sus items en una transaccion. Los fallos llegan como ok:false con el mensaje de la base. */
export async function createAppointmentWithRpc(
  input: CreateAppointmentRpcInput
): Promise<CreateAppointmentRpcResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const payload = toCanonicalPayload({
      ...input.payload,
      idempotency_key: input.idempotencyKey,
    });
    const response = await supabase.rpc("create_appointment", { payload });
    const appointmentId = parseRpcResponse("create_appointment", response, CreateAppointmentResultSchema);
    return { ok: true, appointmentId };
  } catch (error) {
    return { ok: false, errorMessage: errorMessageOf(error) };
  }
}
