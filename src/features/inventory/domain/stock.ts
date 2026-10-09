export const INVENTORY_LOCATIONS = ["retail", "internal", "storage"] as const;

export type InventoryLocation = (typeof INVENTORY_LOCATIONS)[number];

export const INVENTORY_LOCATION_LABELS: Record<InventoryLocation, string> = {
  retail: "Vitrina",
  internal: "Uso interno",
  storage: "Bodega",
};

export function stockStatus(quantity: number, minimumQuantity: number): "ok" | "low" | "empty" {
  if (quantity <= 0) return "empty";
  if (minimumQuantity > 0 && quantity <= minimumQuantity) return "low";
  return "ok";
}
