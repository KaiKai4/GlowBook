import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import { cancelAppointmentRpc } from "../data/rpc/cancel-appointment";
import { assertTransition } from "../domain/lifecycle";
import { APPOINTMENT_MESSAGES } from "../domain/messages";

export async function cancelAppointment(
  appointmentId: string,
  salonId: string,
  idempotencyKey: string
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;
  try {
    appointment = await findAppointmentForCommand(appointmentId, salonId);
  } catch (error) {
    captureError(error, { module: "appointments", action: "cancel" });
    return err(APPOINTMENT_MESSAGES.notFound);
  }

  if (!appointment) return err(APPOINTMENT_MESSAGES.notFound);

  try {
    assertTransition(appointment.status, "cancelled");
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.cancelFailed));
  }

  // Cierre y liberacion de la agenda en una sola transaccion en la base.
  try {
    await cancelAppointmentRpc({ appointmentId, idempotencyKey });
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.cancelError));
  }

  return ok(undefined);
}
