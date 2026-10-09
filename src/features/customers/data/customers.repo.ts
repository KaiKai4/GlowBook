import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { Database } from "@/types/database.types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export async function findCustomers(
  salonId: string,
  options: { q?: string; page?: number; perPage?: number; isActive?: boolean } = {}
) {
  const supabase = await createSupabaseServerClient();
  const { q = "", page = 1, perPage = 10, isActive } = options;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const searchTerm = q.trim().replace(/[%_(),]/g, "");

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("salon_id", salonId)
    .eq("is_temporary", false)
    .order("search_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (searchTerm) {
    query = query.or(
      `search_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
    );
  }
  if (isActive !== undefined) query = query.eq("is_active", isActive);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function createCustomer(
  salonId: string,
  input: Omit<Database["public"]["Tables"]["customers"]["Insert"], "salon_id">
): Promise<CustomerRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...input, salon_id: salonId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findCustomerByPhone(
  salonId: string,
  phone: string
): Promise<CustomerRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("salon_id", salonId)
    .eq("phone", phone)
    .maybeSingle();
  return data;
}

export async function findCustomerByEmail(
  salonId: string,
  email: string
): Promise<CustomerRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("salon_id", salonId)
    .ilike("email", email)
    .maybeSingle();
  return data;
}

export async function deleteCustomer(id: string, salonId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("salon_id", salonId)
    .eq("is_temporary", true);
  if (error) throw error;
}

export async function updateCustomer(
  id: string,
  salonId: string,
  input: Database["public"]["Tables"]["customers"]["Update"]
): Promise<CustomerRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .update(input)
    .eq("id", id)
    .eq("salon_id", salonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
