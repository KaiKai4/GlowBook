import "server-only";

import type { Result } from "@/lib/result";
import { INVENTORY_LOCATIONS, stockStatus, type InventoryLocation } from "../domain/stock";
import {
  findInventoryProducts,
  findRecentInventoryMovements,
  insertInventoryMovement,
  insertInventoryProduct,
  insertStockLocations,
  softDeleteInventoryProduct,
  updateInventoryProduct,
  updateStockMinimums,
} from "../data/inventory.repo";
import type {
  CreateInventoryProductInput,
  UpdateInventoryProductInput,
} from "../schemas";

export interface InventoryStockView {
  location: InventoryLocation;
  label: string;
  quantity: number;
  minimumQuantity: number;
  status: "ok" | "low" | "empty";
}

export interface InventoryProductView {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  isRetailEnabled: boolean;
  isActive: boolean;
  totalQuantity: number;
  stock: InventoryStockView[];
}

export interface InventoryMovementView {
  id: string;
  productName: string;
  location: InventoryLocation;
  movementType: string;
  quantityDelta: number;
  quantityAfter: number;
  note: string;
  createdAt: string;
}

export interface InventoryPageView {
  products: InventoryProductView[];
  lowStock: InventoryProductView[];
  recentMovements: InventoryMovementView[];
}

const LOCATION_LABELS: Record<InventoryLocation, string> = {
  retail: "Vitrina",
  internal: "Uso interno",
  storage: "Bodega",
};

function productNameFromRelation(value: unknown): string {
  if (Array.isArray(value)) return value[0]?.name ?? "Producto";
  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name?: string }).name ?? "Producto");
  }
  return "Producto";
}

export async function getInventoryPage(salonId: string): Promise<InventoryPageView> {
  const [products, movements] = await Promise.all([
    findInventoryProducts(salonId),
    findRecentInventoryMovements(salonId),
  ]);

  const productViews = products.map((product) => {
    const stock = INVENTORY_LOCATIONS.map((location) => {
      const row = product.inventory_stock_locations?.find((item) => item.location === location);
      const quantity = Number(row?.quantity ?? 0);
      const minimumQuantity = Number(row?.minimum_quantity ?? 0);
      return {
        location,
        label: LOCATION_LABELS[location],
        quantity,
        minimumQuantity,
        status: stockStatus(quantity, minimumQuantity),
      };
    });

    return {
      id: product.id,
      name: product.name,
      category: product.category ?? "",
      costPrice: Number(product.cost_price ?? 0),
      salePrice: Number(product.sale_price ?? 0),
      isRetailEnabled: Boolean(product.is_retail_enabled),
      isActive: product.is_active,
      totalQuantity: stock.reduce((sum, item) => sum + item.quantity, 0),
      stock,
    };
  });

  return {
    products: productViews,
    lowStock: productViews.filter((product) =>
      product.stock.some((stock) => stock.status === "low" || stock.status === "empty")
    ),
    recentMovements: movements.map((movement) => ({
      id: movement.id,
      productName: productNameFromRelation(movement.product),
      location: movement.location,
      movementType: movement.movement_type,
      quantityDelta: Number(movement.quantity_delta ?? 0),
      quantityAfter: Number(movement.quantity_after ?? 0),
      note: movement.note ?? "",
      createdAt: movement.created_at,
    })),
  };
}

export async function createInventoryProduct(
  salonId: string,
  input: CreateInventoryProductInput
): Promise<Result<void>> {
  try {
    const product = await insertInventoryProduct(salonId, {
      name: input.name,
      category: input.category,
      cost_price: input.cost_price,
      sale_price: input.sale_price,
      is_retail_enabled: input.is_retail_enabled,
    });

    const stockRows = await insertStockLocations(salonId, product.id, [
      {
        location: "retail",
        quantity: input.retail_quantity,
        minimum_quantity: input.retail_minimum,
      },
      {
        location: "internal",
        quantity: input.internal_quantity,
        minimum_quantity: input.internal_minimum,
      },
      {
        location: "storage",
        quantity: input.storage_quantity,
        minimum_quantity: input.storage_minimum,
      },
    ]);

    for (const row of stockRows) {
      const quantity = Number(row.quantity ?? 0);
      if (quantity > 0) {
        await insertInventoryMovement(salonId, {
          product_id: product.id,
          location: row.location,
          movement_type: "initial",
          quantity_delta: quantity,
          quantity_after: quantity,
          note: "Stock inicial",
        });
      }
    }

    return { ok: true, value: undefined };
  } catch (error) {
    const message = error instanceof Error && error.message.includes("unique")
      ? "Ya existe un producto con ese nombre."
      : "Error al crear el producto.";
    return { ok: false, error: message };
  }
}

export async function updateInventoryProductProfile(
  productId: string,
  salonId: string,
  input: UpdateInventoryProductInput
): Promise<Result<void>> {
  try {
    await updateInventoryProduct(productId, salonId, input);
    await updateStockMinimums(salonId, productId, [
      { location: "retail", minimum_quantity: input.retail_minimum },
      { location: "internal", minimum_quantity: input.internal_minimum },
      { location: "storage", minimum_quantity: input.storage_minimum },
    ]);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar el producto." };
  }
}

export async function deleteInventoryProduct(
  productId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    await softDeleteInventoryProduct(productId, salonId);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Error al eliminar el producto." };
  }
}
