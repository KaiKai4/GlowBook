import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { ServiceCategoryRef } from "@/features/employees/domain/collaborator-assignment";
import { EMPLOYEE_DETAIL_SELECT } from "./employees-select";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

/**
 * Consulta base de colaboradores del salón: columnas pedidas, filtro por salon,
 * filtro opcional por estado activo y orden por apellido.
 */
function scopedEmployeesQuery<Select extends string>(
  supabase: SupabaseServerClient,
  select: Select,
  salonId: string,
  isActive?: boolean
) {
  const query = supabase
    .from("employees")
    .select(select)
    .eq("salon_id", salonId)
    .order("last_name", { ascending: true });

  return isActive === undefined ? query : query.eq("is_active", isActive);
}

export async function findEmployees(salonId: string, isActive?: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await scopedEmployeesQuery(supabase, EMPLOYEE_DETAIL_SELECT, salonId, isActive);
  if (error) throw error;
  return data ?? [];
}

export async function findEmployeeListRows(
  salonId: string,
  isActive?: boolean
): Promise<EmployeeListRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await scopedEmployeesQuery(
    supabase,
    `
      id,
      first_name,
      last_name,
      is_active,
      profile_id,
      services:employee_services(service_id),
      categories:employee_categories(category:service_categories(id, name))
    `,
    salonId,
    isActive
  );
  if (error) throw error;
  return data ?? [];
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
    .select(EMPLOYEE_DETAIL_SELECT)
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
 * Lectura de las categorias activas y de los servicios activos del salón que
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
