import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import { confirmAppointmentRpc } from "../data/rpc/confirm-appointment";
import { assertTransition } from "../domain/lifecycle";
import { APPOINTMENT_MESSAGES } from "../domain/messages";

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
    return err(APPOINTMENT_MESSAGES.notFound);
  }

  if (!appointment) return err(APPOINTMENT_MESSAGES.notFound);

  try {
    assertTransition(appointment.status, "confirmed");
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.confirmFailed));
  }

  // La transicion se valida de nuevo en la base (FOR UPDATE): una cancelacion concurrente no se pisa.
  try {
    await confirmAppointmentRpc({ appointmentId, idempotencyKey });
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.confirmError));
  }

  return ok(undefined);
}
