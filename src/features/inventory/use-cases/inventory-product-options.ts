import "server-only";

import { findInventoryProducts } from "../data/inventory.repo";

export interface InventoryProductOption {
  id: string;
  name: string;
}

export async function getInventoryProductOptions(salonId: string): Promise<InventoryProductOption[]> {
  const products = await findInventoryProducts(salonId);

  return products
    .filter((product) => product.is_active)
    .map((product) => ({
      id: product.id,
      name: product.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
