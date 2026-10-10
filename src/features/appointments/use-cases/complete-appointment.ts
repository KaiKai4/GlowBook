import { assertSalonPaymentMethodEnabled } from "@/features/salon";
import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import {
  findAppointmentForCommand,
  type AppointmentCommandState,
  type AppointmentPaymentMethod,
} from "../data/appointment-commands.repo";
import {
  completeAppointmentRpc,
  type CompleteAppointmentRpcInput,
  type CompleteAppointmentRpcResult,
} from "../data/rpc/complete-appointment";
import { assertTransition } from "../domain/lifecycle";
import { APPOINTMENT_MESSAGES } from "../domain/messages";

interface CompleteAppointmentPriceInput {
  id: string;
  price: number;
  discountPercentage?: number;
}

/** Datos para completar una cita. Todo en camelCase; el mapeo a la RPC vive en data/rpc. */
export interface CompleteAppointmentCommand {
  appointmentId: string;
  salonId: string;
  paymentMethod: AppointmentPaymentMethod;
  itemCharges?: CompleteAppointmentPriceInput[];
  completionPriceNote?: string;
  idempotencyKey: string;
}

/** Dependencias del caso de uso. Producción usa las funciones reales; los tests inyectan fakes. */
export interface CompleteAppointmentDeps {
  isPaymentMethodEnabled: (salonId: string, paymentMethod: AppointmentPaymentMethod) => Promise<boolean>;
  findAppointment: (appointmentId: string, salonId: string) => Promise<AppointmentCommandState | null>;
  completeRpc: (input: CompleteAppointmentRpcInput) => Promise<CompleteAppointmentRpcResult>;
}

const defaultCompleteAppointmentDeps: CompleteAppointmentDeps = {
  isPaymentMethodEnabled: assertSalonPaymentMethodEnabled,
  findAppointment: findAppointmentForCommand,
  completeRpc: completeAppointmentRpc,
};

/**
 * Completa la cita con una unica RPC transaccional: precios y descuentos de los
 * items, totales, liberacion de la agenda y promocion del cliente temporal.
 * Las reglas de precio (validacion, precio variable, rangos) viven en la base.
 * Antes de nada comprueba que el metodo de pago esta habilitado en el salon.
 * Devuelve el resultado validado de la RPC: el total final lo calcula el servidor.
 */
export async function completeAppointment(
  command: CompleteAppointmentCommand,
  deps: CompleteAppointmentDeps = defaultCompleteAppointmentDeps
): Promise<Result<CompleteAppointmentRpcResult>> {
  const { appointmentId, salonId, paymentMethod, idempotencyKey } = command;

  const paymentEnabled = await deps.isPaymentMethodEnabled(salonId, paymentMethod);
  if (!paymentEnabled) return err(APPOINTMENT_MESSAGES.paymentMethodDisabled);

  let appointment: AppointmentCommandState | null;
  try {
    appointment = await deps.findAppointment(appointmentId, salonId);
  } catch (error) {
    captureError(error, { module: "appointments", action: "complete" });
    return err(APPOINTMENT_MESSAGES.notFound);
  }

  if (!appointment) return err(APPOINTMENT_MESSAGES.notFound);

  try {
    assertTransition(appointment.status, "completed");
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.completeFailed));
  }

  try {
    const result = await deps.completeRpc({
      appointmentId,
      paymentMethod,
      completionPriceNote: (command.completionPriceNote ?? "").trim().slice(0, 500),
      itemCharges: command.itemCharges ?? [],
      idempotencyKey,
    });
    return ok(result);
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.completeError));
  }
}
