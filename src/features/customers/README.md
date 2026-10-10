# Customers Module

Responsabilidad: clientes del salón: alta, edición, archivado y reactivación, clientes temporales (creados desde la agenda) y detección de duplicados.

Interface principal (`index.ts`, con `server-only`):

- `getCustomersPage`, `getActiveCustomerOptions`, `CustomerOptionView`.
- `createCustomerProfile`, `updateCustomerProfile`.
- `archiveCustomer`, `reactivateCustomer`.
- `isTemporaryCustomer`, `promoteCustomer`, `deleteTemporaryCustomer`.
- `checkPermanentCustomerByPhone`, `findArchivedCustomerByContact`.

Casos de uso: `use-cases/customer-profile.ts`, `customer-lifecycle.ts`, `customer-temporary.ts`, `customer-duplicates.ts`, `customer-quota.ts`, `get-customers-page.ts`, `customer-options.ts`.

Tablas que usa:

- `customers` (`data/customers.repo.ts`).

Reglas importantes:

- Plan: `checkPlanModuleAccess` con el módulo `customers` y `checkPlanLimit` con la métrica `customers.active`.
- Permiso: `customers.manage` para escribir.
- Un cliente temporal se promueve a permanente con `promoteCustomer`; archivar y reactivar pasan por `customer-lifecycle.ts`.
- Los duplicados se detectan por teléfono antes de crear.

Tests: `schemas.test.ts`, `data/customers.repo.test.ts`, `use-cases/customer-*.test.ts`, `use-cases/get-customers-page.test.ts`.
