# Payments Module

Responsabilidad: catálogo y normalización de métodos de pago del salón (efectivo, tarjeta, transferencia, Yappy, otro).

Interface principal (`index.ts`): módulo puro, sin I/O, seguro para componentes cliente.

- `normalizePaymentMethod`, `normalizePaymentMethods`: limpian y deduplican valores.
- `paymentMethodOptionsFor`, `paymentMethodsOrDefaults`: opciones para selectores, con valores por defecto.
- `isPaymentMethodEnabled`: comprueba si un método está activo en el salón.
- Tipos `PaymentMethod` y `PaymentMethodOption`.

Dominio (`domain/payment-methods.ts`): único archivo del módulo. Los métodos activos del salón se leen en `src/features/salon` (`getSalonPaymentMethods`).

Reglas importantes:

- No accede a Supabase ni a React; cualquier validación de BD queda en el módulo `salon`.
- Los valores por defecto se usan cuando el salón no tiene configuración.

Tests: este módulo no tiene pruebas propias; su uso se cubre desde `src/features/salon` (`use-cases/salon-payment-methods.test.ts`, `use-cases/update-salon-payment-methods.test.ts`) y desde `retail`.
