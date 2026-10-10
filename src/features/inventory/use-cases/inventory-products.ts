import { toAmount } from "@/infra/format/money";
import { captureError } from "@/infra/observability";
import "server-only";

import type { Result } from "@/infra/result";
import { INVENTORY_LOCATIONS, stockStatus, type InventoryLocation } from "../domain/stock";
import {
  findInventoryProducts,
  findRecentInventoryMovements,
  softDeleteInventoryProduct,
} from "../data/inventory.repo";
import {
  createInventoryProductWithStockRpc,
  updateInventoryProductProfileRpc,
  type CreateInventoryProductRpcInput,
  type UpdateInventoryProductRpcInput,
} from "../data/rpc/inventory-product-rpc";
import type {
  CreateInventoryProductInput,
  UpdateInventoryProductInput,
} from "../schemas";

/** Dependencias de los comandos de escritura. Producción usa los adaptadores reales; los tests inyectan fakes. */
export interface InventoryProductsDeps {
  createProductWithStock: (input: CreateInventoryProductRpcInput) => Promise<string>;
  updateProductProfile: (input: UpdateInventoryProductRpcInput) => Promise<void>;
  softDeleteProduct: (productId: string, salonId: string) => Promise<void>;
}

const defaultInventoryProductsDeps: InventoryProductsDeps = {
  createProductWithStock: createInventoryProductWithStockRpc,
  updateProductProfile: updateInventoryProductProfileRpc,
  softDeleteProduct: softDeleteInventoryProduct,
};

interface InventoryStockView {
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

interface InventoryMovementView {
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
      const quantity = toAmount(row?.quantity);
      const minimumQuantity = toAmount(row?.minimum_quantity);
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
      costPrice: toAmount(product.cost_price),
      salePrice: toAmount(product.sale_price),
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
      quantityDelta: toAmount(movement.quantity_delta),
      quantityAfter: toAmount(movement.quantity_after),
      note: movement.note ?? "",
      createdAt: movement.created_at,
    })),
  };
}

/** Duplicado por SQLSTATE 23505 (no por el texto del mensaje, que depende del idioma y del motor). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function createInventoryProduct(
  salonId: string,
  input: CreateInventoryProductInput,
  deps: InventoryProductsDeps = defaultInventoryProductsDeps
): Promise<Result<void>> {
  try {
    await deps.createProductWithStock({
      salonId,
      name: input.name,
      category: input.category || null,
      costPrice: input.cost_price,
      salePrice: input.sale_price,
      isRetailEnabled: input.is_retail_enabled,
      retailQuantity: input.retail_quantity,
      retailMinimum: input.retail_minimum,
      internalQuantity: input.internal_quantity,
      internalMinimum: input.internal_minimum,
      storageQuantity: input.storage_quantity,
      storageMinimum: input.storage_minimum,
    });
    return { ok: true, value: undefined };
  } catch (error) {
    if (!isUniqueViolation(error)) captureError(error, { module: "inventory", action: "create_product" });
    const message = isUniqueViolation(error)
      ? "Ya existe un producto con ese nombre."
      : "Error al crear el producto.";
    return { ok: false, error: message };
  }
}

export async function updateInventoryProductProfile(
  productId: string,
  salonId: string,
  input: UpdateInventoryProductInput,
  deps: InventoryProductsDeps = defaultInventoryProductsDeps
): Promise<Result<void>> {
  try {
    await deps.updateProductProfile({
      salonId,
      productId,
      name: input.name,
      category: input.category || null,
      costPrice: input.cost_price,
      salePrice: input.sale_price,
      isRetailEnabled: input.is_retail_enabled,
      isActive: input.is_active,
      retailMinimum: input.retail_minimum,
      internalMinimum: input.internal_minimum,
      storageMinimum: input.storage_minimum,
    });
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "inventory", action: "update_product" });
    return { ok: false, error: "Error al actualizar el producto." };
  }
}

export async function deleteInventoryProduct(
  productId: string,
  salonId: string,
  deps: InventoryProductsDeps = defaultInventoryProductsDeps
): Promise<Result<void>> {
  try {
    await deps.softDeleteProduct(productId, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "inventory", action: "delete_product" });
    return { ok: false, error: "Error al eliminar el producto." };
  }
}
