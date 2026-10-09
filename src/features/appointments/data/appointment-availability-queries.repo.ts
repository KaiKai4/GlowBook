import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUtcDayBoundaries } from "@/lib/utils/dates";
import type { OccupiedSlot, WorkSchedule } from "../domain/types";
import type { OccupiedByEmployee } from "./appointment-command-types";

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
