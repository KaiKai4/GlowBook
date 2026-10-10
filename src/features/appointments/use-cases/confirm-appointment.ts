import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import {
  findAppointmentForCommand,
  type AppointmentCommandState,
} from "../data/appointment-commands.repo";
import {
  confirmAppointmentRpc,
  type ConfirmAppointmentRpcResult,
} from "../data/rpc/confirm-appointment";
import { assertTransition } from "../domain/lifecycle";
import { APPOINTMENT_MESSAGES } from "../domain/messages";

/** Dependencias del caso de uso. Producción usa las funciones reales; los tests inyectan fakes. */
export interface ConfirmAppointmentDeps {
  findAppointment: (appointmentId: string, salonId: string) => Promise<AppointmentCommandState | null>;
  confirmRpc: (input: { appointmentId: string; idempotencyKey: string }) => Promise<ConfirmAppointmentRpcResult>;
}

const defaultConfirmAppointmentDeps: ConfirmAppointmentDeps = {
  findAppointment: findAppointmentForCommand,
  confirmRpc: confirmAppointmentRpc,
};

export async function confirmAppointment(
  appointmentId: string,
  salonId: string,
  idempotencyKey: string,
  deps: ConfirmAppointmentDeps = defaultConfirmAppointmentDeps
): Promise<Result<void>> {
  let appointment: AppointmentCommandState | null;
  try {
    appointment = await deps.findAppointment(appointmentId, salonId);
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
    await deps.confirmRpc({ appointmentId, idempotencyKey });
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.confirmError));
  }

  return ok(undefined);
}
