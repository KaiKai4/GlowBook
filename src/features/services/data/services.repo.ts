import { createSupabaseServerClient } from "@/lib/supabase/server";
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
      id, name, ordering,
      services(
        id, name, duration_minutes, price, is_active,
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

export async function createService(
  salonId: string,
  input: Omit<Database["public"]["Tables"]["services"]["Insert"], "salon_id">
) {
  const supabase = await createSupabaseServerClient();

  const { data: category } = await supabase
    .from("service_categories")
    .select("id")
    .eq("id", input.category_id!)
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .single();

  if (!category) throw new Error("La categoría no pertenece al salón.");

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

  if (input.category_id) {
    const { data: category } = await supabase
      .from("service_categories")
      .select("id")
      .eq("id", input.category_id)
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .single();

    if (!category) throw new Error("La categoría no pertenece al salón o está inactiva.");
  }

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
