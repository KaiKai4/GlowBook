import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import {
  createEmployeeWithAssignmentsRpc,
  type CreateEmployeeRpcFields,
} from "@/features/employees/data/rpc/create-employee-rpc";
import {
  updateEmployeeProfileRpc,
  type UpdateEmployeeProfileRpcFields,
} from "@/features/employees/data/rpc/update-employee-rpc";
import type { Database } from "@/types/database.types";

// Alta y edicion de perfil van por RPC transaccionales: colaborador, asignaciones
// y email se escriben juntos o no se escribe nada (ver migracion 067).
export async function createEmployee(
  input: CreateEmployeeRpcFields,
  serviceIds: string[],
  categoryIds: string[],
  idempotencyKey: string
): Promise<{ id: string }> {
  const { employeeId } = await createEmployeeWithAssignmentsRpc({
    employee: input,
    serviceIds,
    categoryIds,
    idempotencyKey,
  });
  return { id: employeeId };
}

export async function updateEmployeeProfileRecord(
  employeeId: string,
  input: {
    fields: UpdateEmployeeProfileRpcFields;
    serviceIds?: string[];
    categoryIds?: string[];
    unlinkProfile: boolean;
    idempotencyKey: string;
  }
): Promise<void> {
  await updateEmployeeProfileRpc({ employeeId, ...input });
}

export async function updateEmployee(
  id: string,
  salonId: string,
  input: Database["public"]["Tables"]["employees"]["Update"]
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .update(input)
    .eq("id", id)
    .eq("salon_id", salonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
