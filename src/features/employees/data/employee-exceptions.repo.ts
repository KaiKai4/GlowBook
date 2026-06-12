import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ScheduleExceptionRow {
  id: string;
  exception_date: string;
  reason: string;
}

/** Días libres desde hoy en adelante, ordenados por fecha. */
export async function findUpcomingEmployeeExceptions(
  employeeId: string,
  salonId: string
): Promise<ScheduleExceptionRow[]> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("schedule_exceptions")
    .select("id, exception_date, reason")
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .gte("exception_date", today)
    .order("exception_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function insertEmployeeException(values: {
  salonId: string;
  employeeId: string;
  exceptionDate: string;
  reason: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("schedule_exceptions").insert({
    salon_id: values.salonId,
    employee_id: values.employeeId,
    exception_date: values.exceptionDate,
    reason: values.reason,
  });
  if (error) throw error;
}

export async function deleteEmployeeException(
  exceptionId: string,
  employeeId: string,
  salonId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("schedule_exceptions")
    .delete()
    .eq("id", exceptionId)
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId);
  if (error) throw error;
}
