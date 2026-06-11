import { err, ok, type Result } from "@/lib/result";
import { captureError } from "@/lib/observability";
import {
  findAppointmentForCommand,
  updateAppointmentStatus,
} from "../data/appointment-commands.repo";
import { assertTransition } from "../domain/lifecycle";

export async function confirmAppointment(
  appointmentId: string,
  salonId: string
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;
  try {
    appointment = await findAppointmentForCommand(appointmentId, salonId);
  } catch (error) {
    captureError(error, { module: "appointments", action: "confirm" });
    return err("Cita no encontrada.");
  }

  if (!appointment) return err("Cita no encontrada.");

  try {
    assertTransition(appointment.status, "confirmed");
  } catch (error) {
    return err((error as Error).message);
  }

  try {
    await updateAppointmentStatus({ appointmentId, salonId, status: "confirmed" });
  } catch (error) {
    captureError(error, { module: "appointments", action: "confirm" });
    return err("Error al confirmar la cita.");
  }

  return ok(undefined);
}
