import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { AppointmentCommandState } from "./appointment-command-types";

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

/** Servicios que tiene asignados una cita en sus items actuales (sin mirar si el servicio sigue activo). */
export async function findAppointmentServiceIdsForCommand(
  appointmentId: string,
  salonId: string
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointment_items")
    .select("service_id")
    .eq("appointment_id", appointmentId)
    .eq("salon_id", salonId);

  if (error) throw error;
  return (data ?? []).map((row) => row.service_id);
}
