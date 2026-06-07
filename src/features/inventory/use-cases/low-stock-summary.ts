import "server-only";

import { findLowStockProductCount } from "../data/inventory.repo";

export interface LowStockSummary {
  productCount: number;
}

export async function getLowStockSummary(salonId: string): Promise<LowStockSummary> {
  const productCount = await findLowStockProductCount(salonId);
  return { productCount };
}
