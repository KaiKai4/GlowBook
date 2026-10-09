import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import { confirmAppointmentRpc } from "../data/rpc/confirm-appointment";
import { assertTransition } from "../domain/lifecycle";

export async function confirmAppointment(
  appointmentId: string,
  salonId: string,
  idempotencyKey: string
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
    return err(toPublicErrorMessage(error, "No se pudo confirmar la cita."));
  }

  // La transicion se valida de nuevo en la base (FOR UPDATE): una cancelacion concurrente no se pisa.
  try {
    await confirmAppointmentRpc({ appointmentId, idempotencyKey });
  } catch (error) {
    return err(toPublicErrorMessage(error, "Error al confirmar la cita."));
  }

  return ok(undefined);
}
