import { toPublicErrorMessage } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";
import { captureError } from "@/lib/observability";
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
    captureError(error, { module: "appointments", action: "cancel" });
    return err("Cita no encontrada.");
  }

  if (!appointment) return err("Cita no encontrada.");

  try {
    assertTransition(appointment.status, "cancelled");
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo cancelar la cita."));
  }

  try {
    await setAppointmentItemsCalendarBlocking({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
  } catch (error) {
    captureError(error, { module: "appointments", action: "cancel" });
    return err("Error al liberar la agenda.");
  }

  try {
    await updateAppointmentStatus({ appointmentId, salonId, status: "cancelled" });
  } catch (error) {
    captureError(error, { module: "appointments", action: "cancel" });
    return err("Error al cancelar la cita.");
  }

  return ok(undefined);
}
