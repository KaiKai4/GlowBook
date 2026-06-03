"use server";

import { revalidatePath } from "next/cache";
import { CreateExpenseSchema } from "@/features/expenses/schemas";
import { createExpense, createInventoryPurchaseExpense } from "@/features/expenses/use-cases/expenses";
import { InventoryPurchaseSchema } from "@/features/inventory/schemas";
import { hasPermission, hasSalonFeature, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import type { Result } from "@/lib/result";

async function guard(options: { inventoryPurchase?: boolean } = {}): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasSalonFeature(profile, "expenses") || !hasPermission(profile, PERMISSIONS.EXPENSES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar gastos." };
  }
  if (
    options.inventoryPurchase &&
    (!hasSalonFeature(profile, "inventory") || !hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE))
  ) {
    return { ok: false, error: "No tienes permiso para registrar compras de inventario." };
  }
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

  const parsed = CreateExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await createExpense(guarded.value.salonId, parsed.data);
  if (result.ok) revalidateExpenses();
  return result;
}

export async function createInventoryPurchaseExpenseAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard({ inventoryPurchase: true });
  if (!guarded.ok) return guarded;

  const parsed = InventoryPurchaseSchema.safeParse({
    ...Object.fromEntries(formData),
    supplier_name: formData.get("supplier_name") || formData.get("commerce_name") || "",
    location: "storage",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await createInventoryPurchaseExpense(guarded.value.salonId, parsed.data);
  if (result.ok) revalidateExpenses();
  return result;
}
