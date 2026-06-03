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
import { hasPermission, hasSalonFeature, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasSalonFeature(profile, "inventory") || !hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar inventario." };
  }
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

  const parsed = CreateInventoryProductSchema.safeParse({
    ...Object.fromEntries(formData),
    is_retail_enabled: formData.get("is_retail_enabled") === "true",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

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

  const parsed = UpdateInventoryProductSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    cost_price: formData.get("cost_price"),
    sale_price: formData.get("sale_price"),
    is_retail_enabled: formData.get("is_retail_enabled") === "true",
    is_active: formData.get("is_active") === "true",
    retail_minimum: formData.get("retail_minimum"),
    internal_minimum: formData.get("internal_minimum"),
    storage_minimum: formData.get("storage_minimum"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

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

  const parsed = InventoryTransferSchema.safeParse({
    ...Object.fromEntries(formData),
    from_location: "storage",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const inventory = await getInventoryPage(guarded.value.salonId);
  const product = inventory.products.find((item) => item.id === parsed.data.product_id);
  if (!product) return { ok: false, error: "Producto invalido." };
  if (!product.isRetailEnabled && parsed.data.to_location !== "internal") {
    return { ok: false, error: "Este producto solo puede transferirse de Bodega a Uso interno." };
  }

  const result = await transferInventoryStock(guarded.value.salonId, parsed.data);
  if (result.ok) revalidateInventory();
  return result.ok ? { ok: true, value: "Transferencia registrada." } : result;
}

export async function deleteInventoryProductAction(productId: string): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const result = await deleteInventoryProduct(productId, guarded.value.salonId);
  if (result.ok) revalidateInventory();
  return result.ok ? { ok: true, value: "Producto eliminado." } : result;
}
