"use server";

import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import { CreateExpenseSchema, type CreateExpenseInput } from "@/features/expenses/schemas";
import { inventoryPurchaseFields } from "@/features/expenses/domain/inventory-purchase-fields";
import {
  createExpenseWithPlanLimits,
  createInventoryPurchaseWithPlanLimits,
} from "@/features/expenses/use-cases/expense-writes";
import { InventoryPurchaseSchema, type InventoryPurchaseInput } from "@/features/inventory/schemas";
import type { Result } from "@/infra/result";

// Gastos y compras de inventario: afectan a estas vistas ademas de la propia.
const EXPENSE_PATHS = ["/", "/expenses", "/inventory", "/reports", "/retail"] as const;

// Limite de gastos y compras: 40 escrituras por minuto y usuario.
const EXPENSE_LIMIT = { max: 40, windowMs: 60_000 };

const createExpenseFlow = defineAction<FormData, CreateExpenseInput, string>({
  permission: { key: PERMISSIONS.EXPENSES_MANAGE, deniedMessage: "No tienes permiso para gestionar gastos." },
  rateLimit: { scope: "expenses", options: EXPENSE_LIMIT },
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

const createInventoryPurchaseFlow = defineAction<FormData, InventoryPurchaseInput, string>({
  permission: {
    key: [PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.INVENTORY_MANAGE],
    deniedMessage: "No tienes permiso para registrar compras de inventario y gastos.",
  },
  rateLimit: { scope: "expenses", options: EXPENSE_LIMIT },
  parse: (formData) => parseWithSchema(InventoryPurchaseSchema)(inventoryPurchaseFields(formData)),
  run: (input, session) => createInventoryPurchaseWithPlanLimits(session.salonId, input, input.idempotency_key),
  revalidate: () => EXPENSE_PATHS,
});

export async function createInventoryPurchaseExpenseAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createInventoryPurchaseFlow(formData);
}
