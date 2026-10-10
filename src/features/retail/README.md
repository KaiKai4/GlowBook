# Retail Module

Responsabilidad: venta de productos de mostrador (retail) y su listado.

Interface principal (`index.ts`, con `server-only`):

- `getRetailPage` (`use-cases/retail-sales.ts`): listado de ventas y datos de la pantalla.
- `createRetailSaleWithPlanLimits` (`use-cases/record-retail-sale.ts`): registra una venta.

Piezas internas:

- `schemas.ts`: validación Zod de la venta.
- `data/retail.repo.ts`: lecturas de `retail_sales`.
- `data/rpc/record-retail-sale.ts`: RPC `record_retail_sale`, atómica e idempotente.

Tablas y RPC que usa:

- Tabla: `retail_sales`.
- RPC: `record_retail_sale`.

Reglas importantes:

- Plan: `checkPlanModuleAccess` con `retail`; `checkPlanLimit` con `retail.sales`.
- Permiso: `retail.manage` para vender.
- La RPC `record_retail_sale` registra la venta y descuenta stock en una sola transacción.

Tests: `schemas.test.ts`, `data/retail.repo.test.ts`, `data/rpc/record-retail-sale.test.ts`, `use-cases/record-retail-sale.test.ts`, `use-cases/retail-sales.test.ts`.
