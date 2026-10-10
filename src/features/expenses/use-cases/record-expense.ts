import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { InventoryPurchaseInput } from "@/features/inventory";
import { err, type Result } from "@/infra/result";
import type { CreateExpenseInput } from "../schemas";
import { createExpense, createInventoryPurchaseExpense } from "./expenses";

// Registro de gastos y compras de inventario con sus cupos del plan. Primero el
// modulo y despues el cupo; ambos se consultan antes de persistir.

/** Dependencias del registro de gastos. Producción usa los casos reales; los tests inyectan fakes. */
export interface CreateExpenseWithPlanLimitsDeps {
  checkModuleAccess: typeof checkPlanModuleAccess;
  checkLimit: typeof checkPlanLimit;
  createExpense: typeof createExpense;
}

// Los accesos a otros modulos van dentro de cada funcion: otros tests los mockean parcialmente.
const defaultCreateExpenseWithPlanLimitsDeps: CreateExpenseWithPlanLimitsDeps = {
  checkModuleAccess: (input) => checkPlanModuleAccess(input),
  checkLimit: (input) => checkPlanLimit(input),
  createExpense: (salonId, input, idempotencyKey) => createExpense(salonId, input, idempotencyKey),
};

/** Dependencias de la compra de inventario registrada como gasto. */
export interface CreateInventoryPurchaseWithPlanLimitsDeps {
  checkModuleAccess: typeof checkPlanModuleAccess;
  checkLimit: typeof checkPlanLimit;
  createPurchaseExpense: typeof createInventoryPurchaseExpense;
}

const defaultCreateInventoryPurchaseWithPlanLimitsDeps: CreateInventoryPurchaseWithPlanLimitsDeps = {
  checkModuleAccess: (input) => checkPlanModuleAccess(input),
  checkLimit: (input) => checkPlanLimit(input),
  createPurchaseExpense: (salonId, input, idempotencyKey) =>
    createInventoryPurchaseExpense(salonId, input, idempotencyKey),
};

export async function createExpenseWithPlanLimits(
  salonId: string,
  input: CreateExpenseInput,
  idempotencyKey: string,
  deps: CreateExpenseWithPlanLimitsDeps = defaultCreateExpenseWithPlanLimitsDeps
): Promise<Result<string>> {
  const moduleAccess = await deps.checkModuleAccess({ salonId, moduleKey: "expenses" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await deps.checkLimit({ salonId, metricKey: "expenses.total" });
  if (!limit.ok) return err(limit.error);

  return deps.createExpense(salonId, input, idempotencyKey);
}

export async function createInventoryPurchaseWithPlanLimits(
  salonId: string,
  input: InventoryPurchaseInput,
  idempotencyKey: string,
  deps: CreateInventoryPurchaseWithPlanLimitsDeps = defaultCreateInventoryPurchaseWithPlanLimitsDeps
): Promise<Result<string>> {
  const moduleAccess = await deps.checkModuleAccess({ salonId, moduleKey: "inventory" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await deps.checkLimit({ salonId, metricKey: "inventory.movements" });
  if (!limit.ok) return err(limit.error);

  return deps.createPurchaseExpense(salonId, input, idempotencyKey);
}
