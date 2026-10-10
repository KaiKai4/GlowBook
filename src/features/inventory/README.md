# Inventory Module

Responsabilidad: productos de inventario, stock por ubicación, compras y traspasos entre ubicaciones.

Interface principal (`index.ts`, con `server-only`):

- Productos: `getInventoryPage`, `getInventoryProductOptions`, `updateInventoryProductProfile`, `deleteInventoryProduct`, `createInventoryProductWithPlanLimits`.
- Stock y movimientos: `recordInventoryPurchase`, `transferInventoryStockWithPlanLimits`, `getInventoryPurchaseExpenseHistory`.
- Venta: `getRetailInventoryProducts` y tipo `RetailInventoryProductView`.
- Esquemas: `InventoryLocationSchema`, tipo `InventoryPurchaseInput`.

Casos de uso: `use-cases/inventory-products.ts`, `manage-inventory-products.ts`, `inventory-movements.ts`, `inventory-purchase-expenses.ts`, `retail-inventory-products.ts`.

Dominio puro (`domain/`): `stock.ts` (cálculo de existencias) y `transfer-rules.ts` (reglas de traspaso).

Tablas y RPC que usa:

- Tablas: `inventory_products`, `inventory_stock_locations`, `inventory_movements`, `inventory_purchases`.
- RPC: `record_inventory_purchase`, `record_inventory_transfer` (`data/rpc/`), atómicas e idempotentes.

Reglas importantes:

- Plan: `checkPlanModuleAccess` con `inventory`; `checkPlanLimit` con `inventory.products` e `inventory.movements`.
- Permiso: `inventory.manage`.
- El historial de compras como gasto se lee con `getInventoryPurchaseExpenseHistory`; las reposiciones no se suman dos veces en `expenses` (ver `reports`).

Tests: `domain/stock.test.ts`, `domain/transfer-rules.test.ts`, `data/rpc/*.test.ts`, `use-cases/*.test.ts`.
