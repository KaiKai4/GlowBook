import { normalizePaymentMethod } from "@/features/payments/domain/payment-methods";

export const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const MAX_PAYMENT_METHOD_LENGTH = 64;

export interface HoursDay {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

// Primer día abierto cuyo cierre no es posterior a la apertura, o null si todos son válidos.
export function firstHoursError(hours: readonly HoursDay[], labels: readonly string[] = DAY_LABELS): string | null {
  for (const day of hours) {
    if (day.is_open && !(day.open_time < day.close_time)) {
      return `${labels[day.day_of_week]}: la hora de cierre debe ser mayor que la de apertura.`;
    }
  }
  return null;
}

export type NewPaymentMethodResult = { ok: true; method: string } | { ok: false; error: string };

// Valida un método nuevo antes de añadirlo a la lista: no vacío, máximo 64 caracteres y sin duplicados
// (sin distinguir mayúsculas).
export function validateNewPaymentMethod(value: string, enabled: readonly string[]): NewPaymentMethodResult {
  const method = normalizePaymentMethod(value);
  if (!method) return { ok: false, error: "Escribe un método de pago." };
  if (method.length > MAX_PAYMENT_METHOD_LENGTH) {
    return { ok: false, error: "El método de pago no puede superar 64 caracteres." };
  }
  if (enabled.some((item) => item.toLocaleLowerCase() === method.toLocaleLowerCase())) {
    return { ok: false, error: "Ese método de pago ya esta en la lista." };
  }
  return { ok: true, method };
}
