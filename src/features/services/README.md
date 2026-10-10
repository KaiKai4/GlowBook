# Services Module

Responsabilidad: catálogo de servicios del salón: categorías, servicios, precios, duración y opciones para agenda.

Interface principal (`index.ts`, con `server-only`):

- Lectura: `getServiceCatalog`, `getCategoryServiceOptions`, `getServiceSchedulingOptions`.
- Escritura: `createServiceCategory`, `updateServiceCategory`, `archiveServiceCategory`, `createServiceWithPlan`, `updateCatalogService`.
- Entrada: `parseCreateCategoryInput`, `parseUpdateServiceInput`, `parseCategoryPricingInput`, `parseIdentifier` (`use-cases/service-input.ts`).

Casos de uso: `use-cases/create-category.ts`, `update-category.ts`, `archive-category.ts`, `create-service-with-plan.ts`, `update-service.ts`, `get-service-catalog.ts`.

Dominio puro: `domain/duration.ts` (duración de servicios).

Tablas que usa:

- `service_categories`, `services` (`data/services.repo.ts`).

Reglas importantes:

- Permiso: `services.manage` para escribir.
- La creación de servicios con plan pasa por `createServiceWithPlan`, que recibe un `ServicePlanGate`.

Tests: `schemas.test.ts`, `domain/duration.test.ts`, `use-cases/*.test.ts`, `data/services.repo*.test.ts`.
