export const INVENTORY_LOCATIONS = ["retail", "internal", "storage"] as const;

export type InventoryLocation = (typeof INVENTORY_LOCATIONS)[number];

export const INVENTORY_LOCATION_LABELS: Record<InventoryLocation, string> = {
  retail: "Vitrina",
  internal: "Uso interno",
  storage: "Bodega",
};

export function isInventoryLocation(value: string): value is InventoryLocation {
  return (INVENTORY_LOCATIONS as readonly string[]).includes(value);
}

export function applyStockDelta(current: number, delta: number): number {
  const next = Math.round((current + delta) * 100) / 100;
  if (next < 0) {
    throw new Error("Stock insuficiente para completar el movimiento.");
  }
  return next;
}

export function stockStatus(quantity: number, minimumQuantity: number): "ok" | "low" | "empty" {
  if (quantity <= 0) return "empty";
  if (minimumQuantity > 0 && quantity <= minimumQuantity) return "low";
  return "ok";
}
