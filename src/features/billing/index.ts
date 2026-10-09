// Punto público del módulo billing. Otros módulos importan solo desde aquí.
// Solo se exporta lo que consumen hoy otros módulos (no re-exportar todo).
// Este índice arrastra módulos "server-only": importarlo únicamente desde
// use-cases o rutas de servidor, nunca desde componentes cliente.
export {
  getEffectiveDisabledSalonFeatures,
  getEffectiveSalonPlan,
} from "./use-cases/commercial-plans";
export { readEffectivePlanOrNull } from "./use-cases/effective-plan-fallback";
export { isActionableLimitWarning } from "./domain/commercial-plan";
export { evaluatePaymentStanding } from "./domain/payment-standing";
export type { PaymentStanding } from "./domain/payment-standing";
