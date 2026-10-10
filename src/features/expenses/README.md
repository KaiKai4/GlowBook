# Expenses Module

Responsabilidad: gastos operativos del salón (registro, categorías, totales por mes) y compras de inventario registradas como egreso.

Interface principal (`index.ts`, con `server-only`):

- `getExpensesPage`: listado y resumen de gastos (`use-cases/expenses.ts`).
- `createExpenseWithPlanLimits`: alta de gasto con límites de plan (`use-cases/record-expense.ts`).
- `createInventoryPurchaseWithPlanLimits`: compra de inventario como gasto (`use-cases/record-expense.ts`).

Dominio puro (`domain/`): `categories.ts` (catálogo de categorías), `category-totals.ts` (totales por categoría), `inventory-purchase-fields.ts` y `receipt-url.ts`.

Tablas y RPC que usa:

- Tabla: `expenses` (`data/expenses.repo.ts`).
- RPC: `report_expense_month_totals`, `report_monthly_history` (`data/rpc/`).

Reglas importantes:

- Plan: `checkPlanModuleAccess` con `expenses`; `checkPlanLimit` con `expenses.total`. Las compras de inventario también comprueban `inventory`.
- Permiso: `expenses.manage` para escribir.
- Las reposiciones de inventario no se duplican dentro de gastos manuales: son fuentes distintas (ver `reports`).

Tests: `schemas.test.ts`, `data/expenses.repo.test.ts`, `data/rpc/*.test.ts`, `domain/*.test.ts`, `use-cases/expenses*.test.ts`, `use-cases/record-expense.test.ts`.
