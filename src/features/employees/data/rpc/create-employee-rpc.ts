import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { callIdempotentRpc } from "@/infra/supabase/call-idempotent-rpc";
import { z } from "@/infra/validation/zod";

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
  const parsed = await callIdempotentRpc(supabase, "create_employee_with_assignments", {
    employee: input.employee,
    service_ids: input.serviceIds,
    category_ids: input.categoryIds,
    idempotency_key: input.idempotencyKey,
  }, CreateEmployeeResultSchema);
  return { employeeId: parsed.employee_id };
}
