import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  await supabase.from("employee_services").delete().eq("employee_id", employeeId);
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
  await supabase.from("employee_categories").delete().eq("employee_id", employeeId);
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
