import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type RelatedOne<T> = T | T[] | null;

export interface DashboardMonthAppointmentRow {
  total_price: number | null;
  status: string;
}

export interface DashboardBookedServiceRow {
  service: RelatedOne<{ name: string }>;
  appointment: RelatedOne<{ status: string }>;
}

export interface DashboardPendingConfirmationRow {
  id: string;
  start_time: string | null;
  customer: RelatedOne<{
    first_name: string;
    last_name: string;
    phone: string | null;
  }>;
}

export interface DashboardReportRows {
  todayAppointments: number;
  monthAppointments: DashboardMonthAppointmentRow[];
  totalCustomers: number;
  bookedServices: DashboardBookedServiceRow[];
}

export interface DashboardReportRowsQuery {
  salonId: string;
  todayStart: string;
  todayEnd: string;
  monthStart: string;
}

export async function findDashboardReportRows({
  salonId,
  todayStart,
  todayEnd,
  monthStart,
}: DashboardReportRowsQuery): Promise<DashboardReportRows> {
  const supabase = await createSupabaseServerClient();

  const [todayAppointments, monthAppointments, totalCustomers, bookedServices] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, status", { count: "exact" })
        .eq("salon_id", salonId)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd),
      supabase
        .from("appointments")
        .select("total_price, status")
        .eq("salon_id", salonId)
        .eq("status", "completed")
        .gte("start_time", monthStart),
      supabase
        .from("customers")
        .select("id", { count: "exact" })
        .eq("salon_id", salonId)
        .eq("is_active", true),
      supabase
        .from("appointment_items")
        .select("service:services(name), appointment:appointments(status)")
        .eq("salon_id", salonId)
        .gte("start_time", monthStart),
    ]);

  if (todayAppointments.error) throw todayAppointments.error;
  if (monthAppointments.error) throw monthAppointments.error;
  if (totalCustomers.error) throw totalCustomers.error;
  if (bookedServices.error) throw bookedServices.error;

  return {
    todayAppointments: todayAppointments.count ?? 0,
    monthAppointments: (monthAppointments.data ?? []) as DashboardMonthAppointmentRow[],
    totalCustomers: totalCustomers.count ?? 0,
    bookedServices: (bookedServices.data ?? []) as unknown as DashboardBookedServiceRow[],
  };
}

export async function findPendingConfirmationRows(
  salonId: string,
  from: string,
  limit = 6
): Promise<DashboardPendingConfirmationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, customer:customers(first_name, last_name, phone)")
    .eq("salon_id", salonId)
    .eq("status", "scheduled")
    .gte("start_time", from)
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as DashboardPendingConfirmationRow[];
}
