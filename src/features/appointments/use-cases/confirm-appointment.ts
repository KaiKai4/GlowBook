import { err, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertTransition, type AppointmentStatus } from "../domain/lifecycle";

export async function confirmAppointment(
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
    assertTransition(appointment.status as AppointmentStatus, "confirmed");
  } catch (e) {
    return err((e as Error).message);
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "confirmed" as const })
    .eq("id", appointmentId)
    .eq("salon_id", salonId);

  if (error) return err("Error al confirmar la cita.");
  return ok(undefined);
}
