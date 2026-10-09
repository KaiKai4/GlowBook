import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUtcDayBoundaries } from "@/lib/utils/dates";
import type { Database } from "@/types/database.types";
import type { AppointmentStatus } from "../domain/lifecycle";
import type {
  BusinessHour,
  OccupiedSlot,
  SalonConfig,
  ServiceAssignment,
  WorkSchedule,
} from "../domain/types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

export type AppointmentPaymentMethod = AppointmentRow["payment_method"];

export interface AppointmentCommandState {
  id: string;
  salon_id: string;
  status: AppointmentStatus;
  customer_id: string | null;
}

export interface AppointmentCreationAssignmentRequest {
  service_id: string;
  employee_id: string;
}

export interface AppointmentCreationResources {
  customerExists: boolean;
  salonConfig: SalonConfig | null;
  businessHours: BusinessHour[];
  assignments: Array<{
    service: ServiceAssignment["service"] | null;
    employee: ServiceAssignment["employee"] | null;
  }>;
}

export type OccupiedByEmployee = Record<string, OccupiedSlot[]>;

export async function findAppointmentForCommand(
  appointmentId: string,
  salonId: string
): Promise<AppointmentCommandState | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, status, salon_id, customer_id")
    .eq("id", appointmentId)
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error) throw error;
  return data as AppointmentCommandState | null;
}

export async function findAppointmentCreationResources({
  salonId,
  customerId,
  assignments,
}: {
  salonId: string;
  customerId: string;
  assignments: AppointmentCreationAssignmentRequest[];
}): Promise<AppointmentCreationResources> {
  const supabase = await createSupabaseServerClient();
  const serviceIds = [...new Set(assignments.map((assignment) => assignment.service_id))];
  const employeeIds = [...new Set(assignments.map((assignment) => assignment.employee_id))];

  const [customerResult, salonResult, businessHoursResult, servicesResult, employeesResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("salon_id", salonId)
        .maybeSingle(),
      supabase
        .from("salons")
        .select(
          "min_booking_notice_minutes, min_appointment_duration_minutes, allow_off_hours_bookings, timezone"
        )
        .eq("id", salonId)
        .maybeSingle(),
      supabase
        .from("salon_business_hours")
        .select("day_of_week, is_open, open_time, close_time")
        .eq("salon_id", salonId),
      supabase
        .from("services")
        .select("id, salon_id, duration_minutes, price, is_active, category_id")
        .in("id", serviceIds)
        .eq("salon_id", salonId),
      supabase
        .from("employees")
        .select("id, salon_id, is_active, profile_id")
        .in("id", employeeIds)
        .eq("salon_id", salonId),
    ]);

  if (customerResult.error) throw customerResult.error;
  if (salonResult.error) throw salonResult.error;
  if (businessHoursResult.error) throw businessHoursResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (employeesResult.error) throw employeesResult.error;

  if (!customerResult.data || !salonResult.data) {
    return {
      customerExists: Boolean(customerResult.data),
      salonConfig: (salonResult.data as SalonConfig | null) ?? null,
      businessHours: (businessHoursResult.data ?? []) as BusinessHour[],
      assignments: [],
    };
  }

  const [employeeServicesResult, employeeCategoriesResult] = await Promise.all([
    supabase
      .from("employee_services")
      .select("employee_id, service_id")
      .in("employee_id", employeeIds)
      .in("service_id", serviceIds)
      .eq("salon_id", salonId),
    supabase
      .from("employee_categories")
      .select("employee_id, category_id")
      .in("employee_id", employeeIds)
      .eq("salon_id", salonId),
  ]);

  if (employeeServicesResult.error) throw employeeServicesResult.error;
  if (employeeCategoriesResult.error) throw employeeCategoriesResult.error;

  const serviceIdsByEmployee = new Map<string, string[]>();
  for (const row of employeeServicesResult.data ?? []) {
    const list = serviceIdsByEmployee.get(row.employee_id) ?? [];
    list.push(row.service_id);
    serviceIdsByEmployee.set(row.employee_id, list);
  }

  const categoryIdsByEmployee = new Map<string, string[]>();
  for (const row of employeeCategoriesResult.data ?? []) {
    const list = categoryIdsByEmployee.get(row.employee_id) ?? [];
    list.push(row.category_id);
    categoryIdsByEmployee.set(row.employee_id, list);
  }

  const serviceMap = new Map(
    (servicesResult.data ?? []).map((service) => [
      service.id,
      {
        id: service.id,
        duration_minutes: service.duration_minutes,
        price: Number(service.price),
        salon_id: service.salon_id,
        is_active: service.is_active,
        category_id: service.category_id,
      },
    ])
  );
  const employeeMap = new Map(
    (employeesResult.data ?? []).map((employee) => [
      employee.id,
      {
        id: employee.id,
        salon_id: employee.salon_id,
        is_active: employee.is_active,
        profile_id: employee.profile_id,
        service_ids: serviceIdsByEmployee.get(employee.id) ?? [],
        category_ids: categoryIdsByEmployee.get(employee.id) ?? [],
      },
    ])
  );

  return {
    customerExists: true,
    salonConfig: salonResult.data as SalonConfig,
    businessHours: (businessHoursResult.data ?? []) as BusinessHour[],
    assignments: assignments.map((assignment) => ({
      service: serviceMap.get(assignment.service_id) ?? null,
      employee: employeeMap.get(assignment.employee_id) ?? null,
    })),
  };
}

export async function findEmployeeWorkSchedulesForCommand(
  employeeId: string
): Promise<WorkSchedule[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_schedules")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("employee_id", employeeId)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []) as WorkSchedule[];
}

/**
 * Días libres puntuales del profesional desde hoy hacia adelante (fechas
 * locales del salon). Set pequeno: vacaciones y permisos próximos.
 */
export async function findEmployeeExceptionDatesForCommand(
  employeeId: string
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  // Margen de un día hacia atras para cubrir cualquier desfase de zona horaria.
  today.setUTCDate(today.getUTCDate() - 1);

  const { data, error } = await supabase
    .from("schedule_exceptions")
    .select("exception_date")
    .eq("employee_id", employeeId)
    .gte("exception_date", today.toISOString().slice(0, 10));

  if (error) throw error;
  return (data ?? []).map((row) => row.exception_date);
}

export async function findEmployeeOccupiedSlotsForCommand({
  salonId,
  employeeId,
  date,
  timezone,
  excludeAppointmentId,
}: {
  salonId: string;
  employeeId: string;
  date: Date;
  timezone: string;
  excludeAppointmentId?: string;
}): Promise<OccupiedSlot[]> {
  const supabase = await createSupabaseServerClient();
  const { start, end } = getUtcDayBoundaries(date, timezone);

  let query = supabase
    .from("appointment_items")
    .select("start_time, end_time")
    .eq("salon_id", salonId)
    .eq("employee_id", employeeId)
    .eq("blocks_calendar", true)
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString());

  if (excludeAppointmentId) {
    query = query.neq("appointment_id", excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OccupiedSlot[];
}

export async function findOccupiedSlotsForSalonDate(
  salonId: string,
  date: string,
  excludeAppointmentId?: string
): Promise<OccupiedByEmployee> {
  const supabase = await createSupabaseServerClient();
  const { data: salonData, error: salonError } = await supabase
    .from("salons")
    .select("timezone")
    .eq("id", salonId)
    .single();

  if (salonError) throw salonError;

  const timezone = salonData?.timezone ?? "UTC";

  let probe = new Date(`${date}T12:00:00.000Z`);
  const probeLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(probe);
  if (probeLocal !== date) {
    const delta = probeLocal > date ? -12 : 12;
    probe = new Date(probe.getTime() + delta * 60 * 60_000);
  }

  const { start, end } = getUtcDayBoundaries(probe, timezone);
  let query = supabase
    .from("appointment_items")
    .select("employee_id, start_time, end_time")
    .eq("salon_id", salonId)
    .eq("blocks_calendar", true)
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString());

  if (excludeAppointmentId) {
    query = query.neq("appointment_id", excludeAppointmentId);
  }

  const [{ data }, { data: exceptions }] = await Promise.all([
    query,
    // Días libres del día consultado: el wizard los ve como un bloqueo de día
    // completo y no ofrece horarios de ese profesional.
    supabase
      .from("schedule_exceptions")
      .select("employee_id")
      .eq("salon_id", salonId)
      .eq("exception_date", date),
  ]);

  const occupied: OccupiedByEmployee = {};
  for (const item of data ?? []) {
    (occupied[item.employee_id] ??= []).push({
      start_time: item.start_time,
      end_time: item.end_time,
    });
  }

  for (const exception of exceptions ?? []) {
    (occupied[exception.employee_id] ??= []).push({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });
  }

  return occupied;
}
