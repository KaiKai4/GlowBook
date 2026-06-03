import "server-only";

import type { InventoryLocation } from "../domain/stock";
import { findInventoryProducts } from "../data/inventory.repo";

export interface RetailInventoryStockView {
  location: InventoryLocation;
  quantity: number;
}

export interface RetailInventoryProductView {
  id: string;
  name: string;
  category: string;
  salePrice: number;
  stock: RetailInventoryStockView[];
}

export async function getRetailInventoryProducts(salonId: string): Promise<RetailInventoryProductView[]> {
  const products = await findInventoryProducts(salonId);

  return products
    .filter((product) => product.is_active && product.is_retail_enabled)
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category ?? "",
      salePrice: Number(product.sale_price ?? 0),
      stock: (product.inventory_stock_locations ?? []).map((stock) => ({
        location: stock.location,
        quantity: Number(stock.quantity ?? 0),
      })),
    }));
}
