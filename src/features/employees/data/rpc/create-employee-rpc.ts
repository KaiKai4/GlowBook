import "server-only";

import { toCanonicalPayload } from "@/lib/idempotency/canonical-json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseRpcResponse } from "@/lib/supabase/rpc-response";
import { z } from "@/lib/validation/zod";

const CreateEmployeeResultSchema = z.object({
  employee_id: z.string().uuid(),
});

export interface CreateEmployeeRpcFields {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  specialty: string;
  commission_percentage: number;
  hire_date?: string | null;
}

export interface CreateEmployeeRpcInput {
  employee: CreateEmployeeRpcFields;
  serviceIds: string[];
  categoryIds: string[];
  /** Clave de idempotencia (uuid): un reintento con la misma clave no crea otro colaborador. */
  idempotencyKey: string;
}

/** Alta de colaborador con asignaciones en una sola transaccion (create_employee_with_assignments). */
export async function createEmployeeWithAssignmentsRpc(
  input: CreateEmployeeRpcInput
): Promise<{ employeeId: string }> {
  const supabase = await createSupabaseServerClient();
  const payload = toCanonicalPayload({
    employee: input.employee,
    service_ids: input.serviceIds,
    category_ids: input.categoryIds,
    idempotency_key: input.idempotencyKey,
  });
  const response = await supabase.rpc("create_employee_with_assignments", { payload });
  const parsed = parseRpcResponse(
    "create_employee_with_assignments",
    response,
    CreateEmployeeResultSchema
  );
  return { employeeId: parsed.employee_id };
}
