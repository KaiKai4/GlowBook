// Punto publico del modulo payments. Otros módulos importan solo desde aquí.
// Modulo puro (sin I/O): seguro para componentes cliente.
export {
  isPaymentMethodEnabled,
  normalizePaymentMethod,
  normalizePaymentMethods,
  paymentMethodOptionsFor,
  paymentMethodsOrDefaults,
} from "./domain/payment-methods";
export type { PaymentMethod, PaymentMethodOption } from "./domain/payment-methods";
