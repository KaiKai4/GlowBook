import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUtcDayBoundaries } from "@/lib/utils/dates";
import type { Database } from "@/types/database.types";
import type { OccupiedSlot, WorkSchedule } from "../domain/types";

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
    ordering: number;
    service: { id: string; name: string; duration_minutes: number } | null;
    employee: { id: string; first_name: string; last_name: string } | null;
  }>;
}

export async function findAppointmentById(id: string): Promise<AppointmentWithDetails | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      customer:customers(id, first_name, last_name, phone, email, is_temporary),
      items:appointment_items(
        id, service_id, employee_id, start_time, end_time,
        duration_minutes, price, ordering,
        service:services(id, name, duration_minutes),
        employee:employees(id, first_name, last_name)
      )
    `)
    .eq("id", id)
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
        duration_minutes, price, ordering,
        service:services(id, name, duration_minutes),
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

export async function findOccupiedSlots(
  employeeId: string,
  date: Date,
  timezone: string,
  excludeAppointmentId?: string
): Promise<OccupiedSlot[]> {
  const supabase = await createSupabaseServerClient();
  const { start: dayStart, end: dayEnd } = getUtcDayBoundaries(date, timezone);

  let query = supabase
    .from("appointment_items")
    .select("start_time, end_time")
    .eq("employee_id", employeeId)
    .eq("blocks_calendar", true)
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString());

  if (excludeAppointmentId) {
    query = query.neq("appointment_id", excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OccupiedSlot[];
}

export async function findWorkSchedules(employeeId: string): Promise<WorkSchedule[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_schedules")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("employee_id", employeeId)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []) as WorkSchedule[];
}

