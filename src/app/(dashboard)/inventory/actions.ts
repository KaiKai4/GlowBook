"use server";

import { revalidatePath } from "next/cache";
import {
  CreateInventoryProductSchema,
  InventoryTransferSchema,
  UpdateInventoryProductSchema,
} from "@/features/inventory/schemas";
import {
  createInventoryProduct,
  deleteInventoryProduct,
  getInventoryPage,
  updateInventoryProductProfile,
} from "@/features/inventory/use-cases/inventory-products";
import { transferInventoryStock } from "@/features/inventory/use-cases/inventory-movements";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import type { Result } from "@/lib/result";
import { firstIssueMessage } from "@/lib/validation/first-issue";
import { parseUuid } from "@/lib/validation/route-id";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar inventario." };
  }

  const limited = await assertActionRateLimit(profile.id, "inventory", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;
  return { ok: true, value: { salonId: profile.salon_id } };
}

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/retail");
  revalidatePath("/reports");
}

export async function createInventoryProductAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  const moduleAccess = await checkPlanModuleAccess({ salonId: guarded.value.salonId, moduleKey: "inventory" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: guarded.value.salonId, metricKey: "inventory.products" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const parsed = CreateInventoryProductSchema.safeParse({
    ...Object.fromEntries(formData),
    is_retail_enabled: formData.get("is_retail_enabled") === "true",
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await createInventoryProduct(guarded.value.salonId, parsed.data);
  if (result.ok) revalidateInventory();
  return result.ok ? { ok: true, value: "Producto creado." } : result;
}

export async function updateInventoryProductAction(
  productId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  if (!parseUuid(productId)) return { ok: false, error: "Identificador inválido." };

  // Un campo ausente en FormData llega como null; se pasa como undefined para que
  // Zod aplique los defaults del schema en lugar de rechazar el null.
  const field = (key: string) => formData.get(key) ?? undefined;
  const parsed = UpdateInventoryProductSchema.safeParse({
    name: field("name"),
    category: field("category"),
    cost_price: field("cost_price"),
    sale_price: field("sale_price"),
    is_retail_enabled: formData.get("is_retail_enabled") === "true",
    is_active: formData.get("is_active") === "true",
    retail_minimum: field("retail_minimum"),
    internal_minimum: field("internal_minimum"),
    storage_minimum: field("storage_minimum"),
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await updateInventoryProductProfile(productId, guarded.value.salonId, parsed.data);
  if (result.ok) revalidateInventory();
  return result;
}

export async function transferInventoryStockAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  const moduleAccess = await checkPlanModuleAccess({ salonId: guarded.value.salonId, moduleKey: "inventory" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: guarded.value.salonId, metricKey: "inventory.movements" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const parsed = InventoryTransferSchema.safeParse({
    ...Object.fromEntries(formData),
    from_location: "storage",
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const inventory = await getInventoryPage(guarded.value.salonId);
  const product = inventory.products.find((item) => item.id === parsed.data.product_id);
  if (!product) return { ok: false, error: "Producto inválido." };
  if (!product.isRetailEnabled && parsed.data.to_location !== "internal") {
    return { ok: false, error: "Este producto solo puede transferirse de Bodega a Uso interno." };
  }

  const result = await transferInventoryStock(
    guarded.value.salonId,
    parsed.data,
    parsed.data.idempotency_key
  );
  if (result.ok) revalidateInventory();
  return result.ok ? { ok: true, value: "Transferencia registrada." } : result;
}

export async function deleteInventoryProductAction(productId: string): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  if (!parseUuid(productId)) return { ok: false, error: "Identificador inválido." };

  const result = await deleteInventoryProduct(productId, guarded.value.salonId);
  if (result.ok) revalidateInventory();
  return result.ok ? { ok: true, value: "Producto eliminado." } : result;
}
