import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { getUtcDayBoundaries } from "@/infra/format/dates";
import type { OccupiedSlot, WorkSchedule } from "../domain/types";
import type { OccupiedByEmployee } from "./appointment-command-types";

/** Agrupa filas de varios profesionales por `employee_id` en una sola pasada. */
function groupRowsByEmployee<Row extends { employee_id: string }, Value>(
  rows: Row[],
  toValue: (row: Row) => Value
): Map<string, Value[]> {
  const grouped = new Map<string, Value[]>();
  for (const row of rows) {
    const list = grouped.get(row.employee_id) ?? [];
    list.push(toValue(row));
    grouped.set(row.employee_id, list);
  }
  return grouped;
}

/**
 * Turnos activos de varios profesionales en una sola consulta (sin N+1).
 * Los profesionales sin turnos no aparecen en el mapa.
 */
export async function findWorkSchedulesByEmployeeForCommand({
  salonId,
  employeeIds,
}: {
  salonId: string;
  employeeIds: string[];
}): Promise<Map<string, WorkSchedule[]>> {
  if (employeeIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_schedules")
    .select("employee_id, day_of_week, start_time, end_time, is_active")
    .in("employee_id", employeeIds)
    .eq("salon_id", salonId)
    .eq("is_active", true);

  if (error) throw error;
  return groupRowsByEmployee(data ?? [], (row) => ({
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    end_time: row.end_time,
    is_active: row.is_active,
  }));
}

/**
 * Días libres puntuales de varios profesionales desde hoy hacia adelante (fechas
 * locales del salon). Set pequeno: vacaciones y permisos próximos.
 */
export async function findExceptionDatesByEmployeeForCommand({
  salonId,
  employeeIds,
}: {
  salonId: string;
  employeeIds: string[];
}): Promise<Map<string, string[]>> {
  if (employeeIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const today = new Date();
  // Margen de un día hacia atras para cubrir cualquier desfase de zona horaria.
  today.setUTCDate(today.getUTCDate() - 1);

  const { data, error } = await supabase
    .from("schedule_exceptions")
    .select("employee_id, exception_date")
    .in("employee_id", employeeIds)
    .eq("salon_id", salonId)
    .gte("exception_date", today.toISOString().slice(0, 10));

  if (error) throw error;
  return groupRowsByEmployee(data ?? [], (row) => row.exception_date);
}

/** Bloques de calendario de varios profesionales en el día de `date` (zona del salon), en una consulta. */
export async function findOccupiedSlotsByEmployeeForCommand({
  salonId,
  employeeIds,
  date,
  timezone,
  excludeAppointmentId,
}: {
  salonId: string;
  employeeIds: string[];
  date: Date;
  timezone: string;
  excludeAppointmentId?: string;
}): Promise<Map<string, OccupiedSlot[]>> {
  if (employeeIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { start, end } = getUtcDayBoundaries(date, timezone);

  let query = supabase
    .from("appointment_items")
    .select("employee_id, start_time, end_time")
    .in("employee_id", employeeIds)
    .eq("salon_id", salonId)
    .eq("blocks_calendar", true)
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString());

  if (excludeAppointmentId) {
    query = query.neq("appointment_id", excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return groupRowsByEmployee(data ?? [], (row) => ({
    start_time: row.start_time,
    end_time: row.end_time,
  }));
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
