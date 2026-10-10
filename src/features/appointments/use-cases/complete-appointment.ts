import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import {
  findAppointmentForCommand,
  type AppointmentPaymentMethod,
} from "../data/appointment-commands.repo";
import { completeAppointmentRpc } from "../data/rpc/complete-appointment";
import { assertTransition } from "../domain/lifecycle";
import { APPOINTMENT_MESSAGES } from "../domain/messages";

export interface CompleteAppointmentPriceInput {
  id: string;
  price: number;
  discountPercentage?: number;
}

/**
 * Completa la cita con una unica RPC transaccional: precios y descuentos de los
 * items, totales, liberacion de la agenda y promocion del cliente temporal.
 * Las reglas de precio (validacion, precio variable, rangos) viven en la base.
 */
export async function completeAppointment(
  appointmentId: string,
  salonId: string,
  paymentMethod: AppointmentPaymentMethod,
  itemPrices: CompleteAppointmentPriceInput[] = [],
  completionPriceNote = "",
  idempotencyKey: string
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;
  try {
    appointment = await findAppointmentForCommand(appointmentId, salonId);
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
    await completeAppointmentRpc({
      appointmentId,
      paymentMethod,
      completionPriceNote: completionPriceNote.trim().slice(0, 500),
      itemCharges: itemPrices.map((item) => ({
        id: item.id,
        price: item.price,
        discount_percentage: item.discountPercentage,
      })),
      idempotencyKey,
    });
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.completeError));
  }

  return ok(undefined);
}
