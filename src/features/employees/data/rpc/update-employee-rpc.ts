import "server-only";

import { toCanonicalPayload } from "@/infra/idempotency/canonical-json";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";

const UpdateEmployeeProfileResultSchema = z.object({
  employee_id: z.string().uuid(),
});

/**
 * Campos de perfil a escribir. Solo las claves presentes llegan a la base:
 * una clave ausente significa "no tocar" (nunca se rellena con ""/0).
 */
export interface UpdateEmployeeProfileRpcFields {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  specialty?: string;
  commission_percentage?: number;
}

export interface UpdateEmployeeProfileRpcInput {
  employeeId: string;
  fields: UpdateEmployeeProfileRpcFields;
  /** Ausente = no tocar las asignaciones de servicios. */
  serviceIds?: string[];
  /** Ausente = no tocar las asignaciones de categorias. */
  categoryIds?: string[];
  /** Desvincula la cuenta de acceso (la revocacion de Auth se hace antes, en la app). */
  unlinkProfile: boolean;
  idempotencyKey: string;
}

/** Edicion atomica de perfil, asignaciones y email (update_employee_profile). */
export async function updateEmployeeProfileRpc(
  input: UpdateEmployeeProfileRpcInput
): Promise<{ employeeId: string }> {
  const supabase = await createSupabaseServerClient();
  const payload = toCanonicalPayload({
    employee_id: input.employeeId,
    fields: input.fields,
    service_ids: input.serviceIds,
    category_ids: input.categoryIds,
    unlink_profile: input.unlinkProfile,
    idempotency_key: input.idempotencyKey,
  });
  const response = await supabase.rpc("update_employee_profile", { payload });
  const parsed = parseRpcResponse(
    "update_employee_profile",
    response,
    UpdateEmployeeProfileResultSchema
  );
  return { employeeId: parsed.employee_id };
}
