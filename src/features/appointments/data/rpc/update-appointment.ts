import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { callIdempotentRpc } from "@/infra/supabase/call-idempotent-rpc";
import { z } from "@/infra/validation/zod";
import { toPublicErrorMessage } from "@/infra/errors";
import { APPOINTMENT_MESSAGES } from "../../domain/messages";
import type { CreateAppointmentRpcPayload } from "./create-appointment";
import { classifyAppointmentRpcFailure, type AppointmentRpcFailureReason } from "./rpc-failure-reason";

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
  /** Causa tipada del fallo (solo si ok es false). */
  reason?: AppointmentRpcFailureReason;
}

/** Reemplaza los items de la cita (agenda) en una transaccion. Los fallos llegan como ok:false. */
export async function updateAppointmentWithRpc(
  input: UpdateAppointmentRpcInput
): Promise<UpdateAppointmentRpcResult> {
  try {
    const supabase = await createSupabaseServerClient();
    // update_appointment no devuelve datos: solo importa que no haya error.
    await callIdempotentRpc(supabase, "update_appointment", {
      ...input.payload,
      idempotency_key: input.idempotencyKey,
    }, z.unknown());
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: classifyAppointmentRpcFailure(error),
      errorMessage: toPublicErrorMessage(error, APPOINTMENT_MESSAGES.updateFailed),
    };
  }
}
