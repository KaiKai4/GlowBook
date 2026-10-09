import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { Database } from "@/types/database.types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

export interface AppointmentWithDetails extends AppointmentRow {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    is_temporary: boolean;
  } | null;
  items: Array<{
    id: string;
    service_id: string;
    employee_id: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    price: number;
    discount_amount: number;
    ordering: number;
    service: {
      id: string;
      name: string;
      duration_minutes: number;
      category: { id: string; name: string; pricing_mode: string } | null;
    } | null;
    employee: { id: string; first_name: string; last_name: string } | null;
  }>;
}

export async function findAppointmentById(
  id: string,
  salonId: string
): Promise<AppointmentWithDetails | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      customer:customers(id, first_name, last_name, phone, email, is_temporary),
      items:appointment_items(
        id, service_id, employee_id, start_time, end_time,
        duration_minutes, price, discount_amount, ordering,
        service:services(
          id, name, duration_minutes,
          category:service_categories(id, name, pricing_mode)
        ),
        employee:employees(id, first_name, last_name)
      )
    `)
    .eq("id", id)
    .eq("salon_id", salonId)
    .single();

  if (error) return null;
  return data as unknown as AppointmentWithDetails;
}

export async function findAppointmentsBySalon(
  salonId: string,
  filters: { status?: string; startDate?: string; endDate?: string } = {}
): Promise<AppointmentWithDetails[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("appointments")
    .select(`
      *,
      customer:customers(id, first_name, last_name, phone, email, is_temporary),
      items:appointment_items(
        id, service_id, employee_id, start_time, end_time,
        duration_minutes, price, discount_amount, ordering,
        service:services(
          id, name, duration_minutes,
          category:service_categories(id, name, pricing_mode)
        ),
        employee:employees(id, first_name, last_name)
      )
    `)
    .eq("salon_id", salonId)
    .order("start_time", { ascending: true });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.startDate) query = query.gte("start_time", filters.startDate);
  if (filters.endDate) query = query.lte("start_time", filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AppointmentWithDetails[];
}
