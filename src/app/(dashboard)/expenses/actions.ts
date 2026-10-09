"use server";

import { revalidatePath } from "next/cache";
import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { CreateExpenseSchema, type CreateExpenseInput } from "@/features/expenses/schemas";
import { inventoryPurchaseFields } from "@/features/expenses/domain/inventory-purchase-fields";
import {
  createExpenseWithPlanLimits,
  createInventoryPurchaseWithPlanLimits,
} from "@/features/expenses/use-cases/expense-writes";
import { InventoryPurchaseSchema } from "@/features/inventory/schemas";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { err, type Result } from "@/infra/result";

// Gastos y compras de inventario: afectan a estas vistas ademas de la propia.
const EXPENSE_PATHS = ["/", "/expenses", "/inventory", "/reports", "/retail"] as const;

const createExpenseFlow = defineAction<FormData, CreateExpenseInput, string>({
  permission: { key: PERMISSIONS.EXPENSES_MANAGE, deniedMessage: "No tienes permiso para gestionar gastos." },
  rateLimit: { scope: "expenses", options: { max: 40, windowMs: 60_000 } },
  parse: (formData) => parseWithSchema(CreateExpenseSchema)(Object.fromEntries(formData)),
  run: (input, session) => createExpenseWithPlanLimits(session.salonId, input, input.idempotency_key),
  revalidate: () => EXPENSE_PATHS,
});

export async function createExpenseAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createExpenseFlow(formData);
}

// Esta accion exige dos permisos (gastos e inventario) en un orden fijo antes del
// limite de peticiones; defineAction admite un solo permiso, por eso el flujo se
// escribe explicitamente. Reglas de negocio y revalidacion siguen en el caso de uso.
export async function createInventoryPurchaseExpenseAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.EXPENSES_MANAGE)) {
    return err("No tienes permiso para gestionar gastos.");
  }
  if (!hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE)) {
    return err("No tienes permiso para registrar compras de inventario.");
  }
  const limited = await assertActionRateLimit(profile.id, "expenses", { max: 40, windowMs: 60_000 });
  if (!limited.ok) return limited;

  const parsed = parseWithSchema(InventoryPurchaseSchema)(inventoryPurchaseFields(formData));
  if (!parsed.ok) return parsed;

  const result = await createInventoryPurchaseWithPlanLimits(
    profile.salon_id,
    parsed.value,
    parsed.value.idempotency_key
  );
  if (result.ok) {
    for (const path of EXPENSE_PATHS) revalidatePath(path);
  }
  return result;
}
