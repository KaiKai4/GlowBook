import "server-only";

import type { Result } from "@/lib/result";
import { normalizePaymentMethods } from "@/features/payments/domain/payment-methods";
import { updateSalonPaymentMethods as updateSalonPaymentMethodsRepo } from "../data/salon.repo";
import type { SalonPaymentMethodsInput } from "../schemas";

export async function updateSalonPaymentMethods(
  salonId: string,
  paymentMethods: SalonPaymentMethodsInput
): Promise<Result<void>> {
  try {
    await updateSalonPaymentMethodsRepo(salonId, normalizePaymentMethods(paymentMethods));
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Error al guardar los metodos de pago." };
  }
}
