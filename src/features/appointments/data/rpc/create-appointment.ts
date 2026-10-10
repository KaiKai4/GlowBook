import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { callIdempotentRpc } from "@/infra/supabase/call-idempotent-rpc";
import { z } from "@/infra/validation/zod";
import { toPublicErrorMessage } from "@/infra/errors";
import { APPOINTMENT_MESSAGES } from "../../domain/messages";
import { classifyAppointmentRpcFailure, type AppointmentRpcFailureReason } from "./rpc-failure-reason";

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
  /** Causa tipada del fallo (solo si ok es false). */
  reason?: AppointmentRpcFailureReason;
}

/** Crea la cita y sus items en una transaccion. Los fallos llegan como ok:false con el mensaje de la base. */
export async function createAppointmentWithRpc(
  input: CreateAppointmentRpcInput
): Promise<CreateAppointmentRpcResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const appointmentId = await callIdempotentRpc(supabase, "create_appointment", {
      ...input.payload,
      idempotency_key: input.idempotencyKey,
    }, CreateAppointmentResultSchema);
    return { ok: true, appointmentId };
  } catch (error) {
    return {
      ok: false,
      reason: classifyAppointmentRpcFailure(error),
      errorMessage: toPublicErrorMessage(error, APPOINTMENT_MESSAGES.createFailed),
    };
  }
}
