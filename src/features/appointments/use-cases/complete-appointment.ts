import { promoteCustomer } from "@/features/customers/use-cases/customer-temporary";
import { err, ok, type Result } from "@/lib/result";
import {
  applyAppointmentItemDiscount,
  findAppointmentForCommand,
  setAppointmentItemsCalendarBlocking,
  updateAppointmentStatus,
  type AppointmentPaymentMethod,
} from "../data/appointment-commands.repo";
import { assertTransition } from "../domain/lifecycle";

export async function completeAppointment(
  appointmentId: string,
  salonId: string,
  paymentMethod: AppointmentPaymentMethod,
  discountPercentage = 0
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;
  try {
    appointment = await findAppointmentForCommand(appointmentId, salonId);
  } catch (error) {
    console.error("[appointments:complete]", error);
    return err("Cita no encontrada.");
  }

  if (!appointment) return err("Cita no encontrada.");

  try {
    assertTransition(appointment.status, "completed");
  } catch (error) {
    return err((error as Error).message);
  }

  if (discountPercentage > 0) {
    try {
      await applyAppointmentItemDiscount({ appointmentId, salonId, discountPercentage });
    } catch (error) {
      console.error("[appointments:complete]", error);
      return err("Error al aplicar el descuento.");
    }
  }

  try {
    await updateAppointmentStatus({
      appointmentId,
      salonId,
      status: "completed",
      paymentMethod,
    });
  } catch (error) {
    console.error("[appointments:complete]", error);
    return err("Error al completar la cita.");
  }

  try {
    await setAppointmentItemsCalendarBlocking({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
  } catch (error) {
    console.error("[appointments:complete]", error);
    return err("La cita se completo, pero no se pudo liberar la agenda.");
  }

  if (appointment.customer_id) {
    const promoted = await promoteCustomer(appointment.customer_id, salonId);
    if (!promoted.ok) {
      console.error("[appointments:complete]", promoted.error);
    }
  }

  return ok(undefined);
}
