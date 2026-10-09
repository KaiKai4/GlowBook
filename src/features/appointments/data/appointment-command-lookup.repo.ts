import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
