import "server-only";

import { stockStatus } from "../domain/stock";
import { findInventoryProducts } from "../data/inventory.repo";

export interface LowStockSummary {
  productCount: number;
}

export async function getLowStockSummary(salonId: string): Promise<LowStockSummary> {
  const products = await findInventoryProducts(salonId);

  const productCount = products.filter((product) =>
    (product.inventory_stock_locations ?? []).some((stock) =>
      stockStatus(Number(stock.quantity ?? 0), Number(stock.minimum_quantity ?? 0)) !== "ok"
    )
  ).length;

  return { productCount };
}
