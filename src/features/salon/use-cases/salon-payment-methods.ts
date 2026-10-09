import "server-only";

import { getSalonIdentity } from "./salon-identity";
import {
  isPaymentMethodEnabled,
  paymentMethodsOrDefaults,
  paymentMethodOptionsFor,
  type PaymentMethod,
  type PaymentMethodOption,
} from "@/features/payments";

export interface SalonPaymentMethodsView {
  enabled: PaymentMethod[];
  options: PaymentMethodOption[];
}

export async function getSalonPaymentMethods(salonId: string): Promise<SalonPaymentMethodsView> {
  const salon = await getSalonIdentity(salonId);
  const enabled = paymentMethodsOrDefaults(salon?.payment_methods);
  return {
    enabled,
    options: paymentMethodOptionsFor(enabled),
  };
}

export async function assertSalonPaymentMethodEnabled(
  salonId: string,
  paymentMethod: string
): Promise<boolean> {
  const salon = await getSalonIdentity(salonId);
  return isPaymentMethodEnabled(paymentMethod, salon?.payment_methods);
}
