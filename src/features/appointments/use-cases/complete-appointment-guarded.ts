import { assertSalonPaymentMethodEnabled } from "@/features/salon";
import type { CompleteAppointmentInput } from "@/features/appointments/schemas";
import { err, type Result } from "@/infra/result";
import { completeAppointment } from "./complete-appointment";

const PAYMENT_METHOD_DISABLED_MESSAGE = "Ese metodo de pago no esta habilitado para este salon.";

/**
 * Completa la cita solo si el metodo de pago esta habilitado en el salon. La
 * validacion de formato ya la hizo el parseo del formulario.
 */
export async function completeAppointmentGuarded(
  input: CompleteAppointmentInput,
  salonId: string
): Promise<Result<void>> {
  const enabled = await assertSalonPaymentMethodEnabled(salonId, input.payment_method);
  if (!enabled) return err(PAYMENT_METHOD_DISABLED_MESSAGE);

  return completeAppointment(
    input.appointment_id,
    salonId,
    input.payment_method,
    input.item_charges,
    input.completion_price_note,
    input.idempotency_key
  );
}
