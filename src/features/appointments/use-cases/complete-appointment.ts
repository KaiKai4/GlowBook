import { err, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertTransition, type AppointmentStatus } from "../domain/lifecycle";
import type { Database } from "@/types/database.types";

type PaymentMethod = Database["public"]["Tables"]["appointments"]["Row"]["payment_method"];

export async function completeAppointment(
  appointmentId: string,
  salonId: string,
  paymentMethod: PaymentMethod
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
    assertTransition(appointment.status as AppointmentStatus, "completed");
  } catch (e) {
    return err((e as Error).message);
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "completed" as const, payment_method: paymentMethod })
    .eq("id", appointmentId);

  if (error) return err("Error al completar la cita.");

  return ok(undefined);
}
