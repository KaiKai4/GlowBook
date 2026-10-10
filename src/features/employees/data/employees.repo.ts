import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { ServiceCategoryRef } from "@/features/employees/domain/collaborator-assignment";
import {
  createEmployeeWithAssignmentsRpc,
  type CreateEmployeeRpcFields,
} from "@/features/employees/data/rpc/create-employee-rpc";
import {
  updateEmployeeProfileRpc,
  type UpdateEmployeeProfileRpcFields,
} from "@/features/employees/data/rpc/update-employee-rpc";
import type { Database } from "@/types/database.types";

export interface EmployeeNameRow {
  id: string;
  first_name: string;
  last_name: string;
}

export interface EmployeeListRow {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile_id: string | null;
  services: Array<{ service_id: string | null }>;
  categories: Array<{ category: { id: string; name: string } | null }>;
}

export async function findEmployees(salonId: string, isActive?: boolean) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("employees")
    .select(`
      *,
      services:employee_services(service:services(id, name, duration_minutes, price)),
      categories:employee_categories(category:service_categories(id, name)),
      work_schedules(id, day_of_week, start_time, end_time, is_active)
    `)
    .eq("salon_id", salonId)
    .order("last_name", { ascending: true });

  if (isActive !== undefined) query = query.eq("is_active", isActive);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function findEmployeeListRows(
  salonId: string,
  isActive?: boolean
): Promise<EmployeeListRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("employees")
    .select(`
      id,
      first_name,
      last_name,
      is_active,
      profile_id,
      services:employee_services(service_id),
      categories:employee_categories(category:service_categories(id, name))
    `)
    .eq("salon_id", salonId)
    .order("last_name", { ascending: true });

  if (isActive !== undefined) query = query.eq("is_active", isActive);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as EmployeeListRow[];
}

export async function findActiveEmployeeNames(salonId: string): Promise<EmployeeNameRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("first_name");

  if (error) throw error;
  return data ?? [];
}

export async function findEmployeeById(id: string, salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select(`
      *,
      services:employee_services(service:services(id, name, duration_minutes, price)),
      categories:employee_categories(category:service_categories(id, name)),
      work_schedules(id, day_of_week, start_time, end_time, is_active)
    `)
    .eq("id", id)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findEmployeeByEmail(email: string, salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("salon_id", salonId)
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Lectura de las categorias activas y de los servicios activos del salon que
 * coinciden con los ids pedidos. Solo consulta: las reglas de asignacion viven en
 * el caso de uso (employee-assignments.ts).
 */
export async function findActiveAssignmentReferences(
  salonId: string,
  serviceIds: string[],
  categoryIds: string[]
): Promise<{ activeCategoryIds: string[]; services: ServiceCategoryRef[] }> {
  const supabase = await createSupabaseServerClient();

  let activeCategoryIds: string[] = [];
  if (categoryIds.length > 0) {
    const { data, error } = await supabase
      .from("service_categories")
      .select("id")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .in("id", categoryIds);

    if (error) throw error;
    activeCategoryIds = (data ?? []).map((row) => row.id);
  }

  let services: ServiceCategoryRef[] = [];
  if (serviceIds.length > 0) {
    const { data, error } = await supabase
      .from("services")
      .select("id, category_id")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .in("id", serviceIds);

    if (error) throw error;
    services = data ?? [];
  }

  return { activeCategoryIds, services };
}

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

export async function upsertWorkSchedule(
  salonId: string,
  schedule: Omit<Database["public"]["Tables"]["work_schedules"]["Insert"], "salon_id">
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_schedules")
    .upsert({ ...schedule, salon_id: salonId }, { onConflict: "salon_id,employee_id,day_of_week,start_time,end_time" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkSchedule(id: string, salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("work_schedules")
    .delete()
    .eq("id", id)
    .eq("salon_id", salonId);
  if (error) throw error;
}

// El token en claro no existe en la DB (solo su hash), asi que una invitacion
// pendiente solo expone metadatos: el enlace se muestra una unica vez al
// generarse y despues solo puede regenerarse.
export interface EmployeeInvitationRow {
  id: string;
  email: string;
  role_id: string | null;
  expires_at: string;
  accepted_at: string | null;
}

export async function findLatestEmployeeInvitation(
  employeeId: string,
  salonId: string
): Promise<EmployeeInvitationRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employee_invitations")
    .select("id, email, role_id, expires_at, accepted_at")
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as EmployeeInvitationRow | null;
}
