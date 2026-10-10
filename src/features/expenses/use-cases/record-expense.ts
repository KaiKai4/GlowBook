import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { InventoryPurchaseInput } from "@/features/inventory";
import { err, type Result } from "@/infra/result";
import type { CreateExpenseInput } from "../schemas";
import { createExpense, createInventoryPurchaseExpense } from "./expenses";

// Registro de gastos y compras de inventario con sus cupos del plan. Primero el
// modulo y despues el cupo; ambos se consultan antes de persistir.

export async function createExpenseWithPlanLimits(
  salonId: string,
  input: CreateExpenseInput,
  idempotencyKey: string
): Promise<Result<string>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "expenses" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await checkPlanLimit({ salonId, metricKey: "expenses.total" });
  if (!limit.ok) return err(limit.error);

  return createExpense(salonId, input, idempotencyKey);
}

export async function createInventoryPurchaseWithPlanLimits(
  salonId: string,
  input: InventoryPurchaseInput,
  idempotencyKey: string
): Promise<Result<string>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "inventory" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await checkPlanLimit({ salonId, metricKey: "inventory.movements" });
  if (!limit.ok) return err(limit.error);

  return createInventoryPurchaseExpense(salonId, input, idempotencyKey);
}
