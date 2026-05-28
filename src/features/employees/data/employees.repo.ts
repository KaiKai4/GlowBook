import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertServicesHaveAssignedCategories } from "@/features/services/domain/service-assignment-integrity";
import type { Database } from "@/types/database.types";

export interface EmployeeWithDetails {
  id: string;
  salon_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  specialty: string;
  commission_percentage: number;
  hire_date: string | null;
  is_active: boolean;
  services: Array<{ id: string; name: string; duration_minutes: number; price: number }>;
  categories: Array<{ id: string; name: string }>;
  work_schedules: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }>;
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
    .single();
  if (error) return null;
  return data;
}

export async function findEmployeeByEmail(email: string, salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("employees")
    .select("*")
    .eq("salon_id", salonId)
    .ilike("email", email)
    .maybeSingle();
  return data;
}

export async function validateEmployeeAssignments(
  salonId: string,
  serviceIds: string[],
  categoryIds: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const uniqueServiceIds = [...new Set(serviceIds)];
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const categorySet = new Set(uniqueCategoryIds);

  if (uniqueCategoryIds.length > 0) {
    const { data: categories, error } = await supabase
      .from("service_categories")
      .select("id")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .in("id", uniqueCategoryIds);

    if (error) throw error;
    if ((categories ?? []).length !== uniqueCategoryIds.length) {
      throw new Error("Una o mas categorias no pertenecen al salon o estan inactivas.");
    }
  }

  if (uniqueServiceIds.length === 0) return;

  const { data: services, error } = await supabase
    .from("services")
    .select("id, category_id")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .in("id", uniqueServiceIds);

  if (error) throw error;
  if ((services ?? []).length !== uniqueServiceIds.length) {
    throw new Error("Uno o mas servicios no pertenecen al salon o estan inactivos.");
  }

  assertServicesHaveAssignedCategories(services ?? [], [...categorySet]);
}

export async function createEmployee(
  salonId: string,
  input: Omit<Database["public"]["Tables"]["employees"]["Insert"], "salon_id">,
  serviceIds: string[],
  categoryIds: string[]
) {
  const supabase = await createSupabaseServerClient();

  const { data: employee, error } = await supabase
    .from("employees")
    .insert({ ...input, salon_id: salonId })
    .select()
    .single();
  if (error) throw error;

  if (serviceIds.length > 0) {
    await supabase.from("employee_services").insert(
      serviceIds.map((service_id) => ({
        employee_id: employee.id,
        service_id,
        salon_id: salonId,
      }))
    );
  }

  if (categoryIds.length > 0) {
    await supabase.from("employee_categories").insert(
      categoryIds.map((category_id) => ({
        employee_id: employee.id,
        category_id,
        salon_id: salonId,
      }))
    );
  }

  return employee;
}

export async function updateEmployeeServices(
  employeeId: string,
  salonId: string,
  serviceIds: string[]
) {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("employee_services")
    .delete()
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId);
  if (serviceIds.length > 0) {
    await supabase.from("employee_services").insert(
      serviceIds.map((service_id) => ({ employee_id: employeeId, service_id, salon_id: salonId }))
    );
  }
}

export async function updateEmployeeCategories(
  employeeId: string,
  salonId: string,
  categoryIds: string[]
) {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("employee_categories")
    .delete()
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId);
  if (categoryIds.length > 0) {
    await supabase.from("employee_categories").insert(
      categoryIds.map((category_id) => ({ employee_id: employeeId, category_id, salon_id: salonId }))
    );
  }
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

export async function deleteEmployee(id: string, salonId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("salon_id", salonId);
  if (error) throw error;
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

export interface EmployeeInvitationRow {
  id: string;
  token: string;
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
  const { data } = await supabase
    .from("employee_invitations")
    .select("id, token, email, role_id, expires_at, accepted_at")
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as EmployeeInvitationRow | null;
}
