export type PaymentMethod = string;

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
}

const DEFAULT_PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "yappy", label: "Yappy" },
  { value: "other", label: "Otro" },
];

const DEFAULT_PAYMENT_METHODS = DEFAULT_PAYMENT_METHOD_OPTIONS.map((option) => option.value);
const DEFAULT_PAYMENT_METHOD_LABELS = new Map(
  DEFAULT_PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label])
);

export function normalizePaymentMethod(value: string): PaymentMethod {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePaymentMethods(values: readonly string[] | null | undefined): PaymentMethod[] {
  const seen = new Set<string>();
  const normalized: PaymentMethod[] = [];

  for (const value of values ?? []) {
    const method = normalizePaymentMethod(value);
    const key = method.toLocaleLowerCase();
    if (!method || seen.has(key)) continue;
    seen.add(key);
    normalized.push(method);
  }

  return normalized;
}

export function paymentMethodsOrDefaults(values: readonly string[] | null | undefined): PaymentMethod[] {
  const normalized = normalizePaymentMethods(values);
  return normalized.length > 0 ? normalized : DEFAULT_PAYMENT_METHODS;
}

export function paymentMethodLabel(value: string): string {
  return DEFAULT_PAYMENT_METHOD_LABELS.get(value) ?? value;
}

export function paymentMethodOptionsFor(values: readonly string[] | null | undefined): PaymentMethodOption[] {
  return paymentMethodsOrDefaults(values).map((value) => ({
    value,
    label: paymentMethodLabel(value),
  }));
}

export function isPaymentMethodEnabled(
  method: string,
  enabledMethods: readonly string[] | null | undefined
): boolean {
  const normalizedMethod = normalizePaymentMethod(method).toLocaleLowerCase();
  return paymentMethodsOrDefaults(enabledMethods).some(
    (enabled) => enabled.toLocaleLowerCase() === normalizedMethod
  );
}
