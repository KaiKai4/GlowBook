import "server-only";

import type { Result } from "@/lib/result";
import { normalizePaymentMethods } from "@/features/payments/domain/payment-methods";
import { updateSalonPaymentMethods as updateSalonPaymentMethodsRepo } from "../data/salon.repo";
import type { SalonPaymentMethodsInput } from "../schemas";

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42703" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("payment_methods")
  ) {
    return "falta aplicar la migracion 20240101000044_salon_payment_methods.sql en Supabase.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Error desconocido.";
}

export async function updateSalonPaymentMethods(
  salonId: string,
  paymentMethods: SalonPaymentMethodsInput
): Promise<Result<void>> {
  try {
    await updateSalonPaymentMethodsRepo(salonId, normalizePaymentMethods(paymentMethods));
    return { ok: true, value: undefined };
  } catch (error) {
    console.error("Error saving salon payment methods", error);
    return {
      ok: false,
      error: `Error al guardar los metodos de pago: ${errorMessage(error)}`,
    };
  }
}
