import { err, ok, type Result } from "@/lib/result";
import {
  findAppointmentForCommand,
  setAppointmentItemsCalendarBlocking,
  updateAppointmentStatus,
} from "../data/appointment-commands.repo";
import { assertTransition } from "../domain/lifecycle";

export async function cancelAppointment(
  appointmentId: string,
  salonId: string
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;
  try {
    appointment = await findAppointmentForCommand(appointmentId, salonId);
  } catch (error) {
    console.error("[appointments:cancel]", error);
    return err("Cita no encontrada.");
  }

  if (!appointment) return err("Cita no encontrada.");

  try {
    assertTransition(appointment.status, "cancelled");
  } catch (error) {
    return err((error as Error).message);
  }

  try {
    await setAppointmentItemsCalendarBlocking({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
  } catch (error) {
    console.error("[appointments:cancel]", error);
    return err("Error al liberar la agenda.");
  }

  try {
    await updateAppointmentStatus({ appointmentId, salonId, status: "cancelled" });
  } catch (error) {
    console.error("[appointments:cancel]", error);
    return err("Error al cancelar la cita.");
  }

  return ok(undefined);
}
