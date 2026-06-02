import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  COMPLETED_APPOINTMENT_STATUS,
  type ReportAppointment,
  type ReportAppointmentItem,
} from "../domain/metrics";

type AppointmentRow = Pick<
  Database["public"]["Tables"]["appointments"]["Row"],
  "id" | "status" | "total_price" | "discount_amount"
>;

type RelatedOne<T> = T | T[] | null;

type AppointmentItemRow = {
  appointment_id: string;
  price: number | null;
  discount_amount: number | null;
  service: RelatedOne<{ id: string; name: string }>;
  employee: RelatedOne<{ id: string; first_name: string; last_name: string }>;
};

export interface OperationalReportRows {
  appointments: ReportAppointment[];
  items: ReportAppointmentItem[];
  newCustomers: number;
}

export interface OperationalReportRowQuery {
  salonId: string;
  start: string;
  end: string;
}

function firstRelation<T>(value: RelatedOne<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function normalizeAppointment(row: AppointmentRow): ReportAppointment {
  return {
    id: row.id,
    status: row.status,
    totalPrice: Number(row.total_price ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
  };
}

function normalizeItem(row: AppointmentItemRow): ReportAppointmentItem {
  const service = firstRelation(row.service);
  const employee = firstRelation(row.employee);
  const employeeName = employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : null;

  return {
    appointmentId: row.appointment_id,
    price: Math.max(0, Number(row.price ?? 0) - Number(row.discount_amount ?? 0)),
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? null,
    employeeId: employee?.id ?? null,
    employeeName: employeeName || null,
  };
}

export async function findSalonTimezone(salonId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salons")
    .select("timezone")
    .eq("id", salonId)
    .maybeSingle();

  if (error) throw error;
  return data?.timezone ?? null;
}

export async function findOperationalReportRows({
  salonId,
  start,
  end,
}: OperationalReportRowQuery): Promise<OperationalReportRows> {
  const supabase = await createSupabaseServerClient();

  const [appointmentsResponse, newCustomersResponse] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, total_price, discount_amount")
      .eq("salon_id", salonId)
      .gte("start_time", start)
      .lte("start_time", end),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("is_temporary", false)
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

  if (appointmentsResponse.error) throw appointmentsResponse.error;
  if (newCustomersResponse.error) throw newCustomersResponse.error;

  const appointments = (appointmentsResponse.data ?? []).map(normalizeAppointment);
  const completedAppointmentIds = appointments
    .filter((appointment) => appointment.status === COMPLETED_APPOINTMENT_STATUS)
    .map((appointment) => appointment.id);

  let items: ReportAppointmentItem[] = [];
  if (completedAppointmentIds.length > 0) {
    const { data, error } = await supabase
      .from("appointment_items")
      .select(
        "appointment_id, price, discount_amount, service:services(id, name), employee:employees(id, first_name, last_name)"
      )
      .eq("salon_id", salonId)
      .in("appointment_id", completedAppointmentIds);

    if (error) throw error;
    items = ((data ?? []) as unknown as AppointmentItemRow[]).map(normalizeItem);
  }

  return {
    appointments,
    items,
    newCustomers: newCustomersResponse.count ?? 0,
  };
}
