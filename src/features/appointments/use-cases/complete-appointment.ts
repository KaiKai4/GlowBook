import { err, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertTransition, type AppointmentStatus } from "../domain/lifecycle";
import type { Database } from "@/types/database.types";

type PaymentMethod = Database["public"]["Tables"]["appointments"]["Row"]["payment_method"];

export async function completeAppointment(
  appointmentId: string,
  salonId: string,
  paymentMethod: PaymentMethod,
  discountPercentage = 0
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

  if (discountPercentage > 0) {
    const { data: items, error: itemsReadError } = await supabase
      .from("appointment_items")
      .select("id, price")
      .eq("appointment_id", appointmentId)
      .eq("salon_id", salonId);

    if (itemsReadError) return err("Error al calcular el descuento.");

    for (const item of items ?? []) {
      const factor = 1 - discountPercentage / 100;
      const newPrice = Math.round(Number(item.price) * factor * 100) / 100;
      const { error: itemError } = await supabase
        .from("appointment_items")
        .update({ price: newPrice })
        .eq("id", item.id)
        .eq("salon_id", salonId);

      if (itemError) return err("Error al aplicar el descuento.");
    }
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "completed" as const, payment_method: paymentMethod })
    .eq("id", appointmentId)
    .eq("salon_id", salonId);

  if (error) return err("Error al completar la cita.");

  const { error: itemsError } = await supabase
    .from("appointment_items")
    .update({ blocks_calendar: false })
    .eq("appointment_id", appointmentId)
    .eq("salon_id", salonId);

  if (itemsError) return err("La cita se completó, pero no se pudo liberar la agenda.");

  return ok(undefined);
}
