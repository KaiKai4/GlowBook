// Punto publico del modulo payments. Otros modulos importan solo desde aqui.
// Modulo puro (sin I/O): seguro para componentes cliente.
export {
  isPaymentMethodEnabled,
  normalizePaymentMethod,
  normalizePaymentMethods,
  paymentMethodOptionsFor,
  paymentMethodsOrDefaults,
} from "./domain/payment-methods";
export type { PaymentMethod, PaymentMethodOption } from "./domain/payment-methods";
