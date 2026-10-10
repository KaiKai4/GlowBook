import { captureError } from "@/infra/observability";
import "server-only";

import type { Result } from "@/infra/result";
import { normalizePaymentMethods } from "@/features/payments";
import { updateSalonPaymentMethods as updateSalonPaymentMethodsRepo } from "../data/salon-settings.repo";
import type { SalonPaymentMethodsInput } from "../schemas";

// Mensaje fijo para el usuario. El detalle tecnico (p. ej. una migracion
// pendiente) no sale a la interfaz: se registra con captureError.
const SAVE_FAILED_MESSAGE = "No se pudieron guardar los metodos de pago.";

export async function updateSalonPaymentMethods(
  salonId: string,
  paymentMethods: SalonPaymentMethodsInput
): Promise<Result<void>> {
  try {
    await updateSalonPaymentMethodsRepo(salonId, normalizePaymentMethods(paymentMethods));
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "salon", action: "update-payment-methods" });
    return { ok: false, error: SAVE_FAILED_MESSAGE };
  }
}
