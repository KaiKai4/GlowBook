import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { Database } from "@/types/database.types";

export async function findCategoriesWithServices(salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("*, services(*)")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("ordering", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function findServicesCatalog(salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select(`
      id, name, ordering, pricing_mode,
      services(
        id, category_id, name, description, duration_minutes, price, is_active,
        employee_services(employee:employees(id, first_name, last_name, is_active))
      )
    `)
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("ordering", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCategory(
  salonId: string,
  input: Omit<Database["public"]["Tables"]["service_categories"]["Insert"], "salon_id">
) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("service_categories")
    .insert({ ...input, salon_id: salonId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(
  id: string,
  salonId: string,
  input: Database["public"]["Tables"]["service_categories"]["Update"]
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_categories")
    .update(input)
    .eq("id", id)
    .eq("salon_id", salonId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveCategory(id: string, salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_categories")
    .update({ is_active: false })
    .eq("id", id)
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function createService(
  salonId: string,
  input: Omit<Database["public"]["Tables"]["services"]["Insert"], "salon_id">
) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("services")
    .insert({ ...input, salon_id: salonId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateService(
  id: string,
  salonId: string,
  input: Database["public"]["Tables"]["services"]["Update"]
) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("services")
    .update(input)
    .eq("id", id)
    .eq("salon_id", salonId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Consulta la categoria activa del salon. Solo lee: la regla de negocio que
 * decide si la categoria sirve para un servicio vive en validate-service-category.
 */
export async function findActiveServiceCategory(
  salonId: string,
  categoryId: string
): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
