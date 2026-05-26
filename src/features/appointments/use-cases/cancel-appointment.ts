import { err, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertTransition, type AppointmentStatus } from "../domain/lifecycle";

export async function cancelAppointment(
  appointmentId: string,
  salonId: string
): Promise<Result<void>> {
  const supabase = await createSupabaseServerClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status, salon_id")
    .eq("id", appointmentId)
    .eq("salon_id", salonId)
    .single();

  if (!appointment) return err("Cita no encontrada.");

  try {
    assertTransition(appointment.status as AppointmentStatus, "cancelled");
  } catch (e) {
    return err((e as Error).message);
  }

  const { error: itemsError } = await supabase
    .from("appointment_items")
    .update({ blocks_calendar: false })
    .eq("appointment_id", appointmentId)
    .eq("salon_id", salonId);

  if (itemsError) return err("Error al liberar la agenda.");

  const { error: apptError } = await supabase
    .from("appointments")
    .update({ status: "cancelled" as const })
    .eq("id", appointmentId)
    .eq("salon_id", salonId);

  if (apptError) return err("Error al cancelar la cita.");

  return ok(undefined);
}
