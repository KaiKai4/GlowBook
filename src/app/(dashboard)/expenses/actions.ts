"use server";

import { revalidatePath } from "next/cache";
import { CreateExpenseSchema } from "@/features/expenses/schemas";
import { createExpense, createInventoryPurchaseExpense } from "@/features/expenses/use-cases/expenses";
import { InventoryPurchaseSchema } from "@/features/inventory/schemas";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import type { Result } from "@/lib/result";
import { firstIssueMessage } from "@/lib/validation/first-issue";

async function guard(options: { inventoryPurchase?: boolean } = {}): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.EXPENSES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar gastos." };
  }
  if (options.inventoryPurchase && !hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE)) {
    return { ok: false, error: "No tienes permiso para registrar compras de inventario." };
  }
  const limited = await assertActionRateLimit(profile.id, "expenses", { max: 40, windowMs: 60_000 });
  if (!limited.ok) return limited;
  return { ok: true, value: { salonId: profile.salon_id } };
}

function revalidateExpenses() {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/inventory");
  revalidatePath("/reports");
  revalidatePath("/retail");
}

export async function createExpenseAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  const moduleAccess = await checkPlanModuleAccess({ salonId: guarded.value.salonId, moduleKey: "expenses" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: guarded.value.salonId, metricKey: "expenses.total" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const parsed = CreateExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await createExpense(
    guarded.value.salonId,
    parsed.data,
    parsed.data.idempotency_key
  );
  if (result.ok) revalidateExpenses();
  return result;
}

export async function createInventoryPurchaseExpenseAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard({ inventoryPurchase: true });
  if (!guarded.ok) return guarded;
  const moduleAccess = await checkPlanModuleAccess({ salonId: guarded.value.salonId, moduleKey: "inventory" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: guarded.value.salonId, metricKey: "inventory.movements" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const parsed = InventoryPurchaseSchema.safeParse({
    ...Object.fromEntries(formData),
    supplier_name: formData.get("supplier_name") || formData.get("commerce_name") || "",
    location: "storage",
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await createInventoryPurchaseExpense(
    guarded.value.salonId,
    parsed.data,
    parsed.data.idempotency_key
  );
  if (result.ok) revalidateExpenses();
  return result;
}
