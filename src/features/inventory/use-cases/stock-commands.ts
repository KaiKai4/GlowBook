import "server-only";

import type { Result } from "@/lib/result";
import { applyStockDelta, type InventoryLocation } from "../domain/stock";
import {
  findStockLocation,
  insertInventoryMovement,
  setStockQuantity,
} from "../data/inventory.repo";

export async function adjustInventoryStock({
  salonId,
  productId,
  location,
  delta,
  movementType,
  note,
  referenceType,
  referenceId,
}: {
  salonId: string;
  productId: string;
  location: InventoryLocation;
  delta: number;
  movementType: string;
  note?: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<Result<{ quantityAfter: number }>> {
  try {
    const stock = await findStockLocation(salonId, productId, location);
    if (!stock) return { ok: false, error: "No existe stock para esa ubicación." };

    const quantityAfter = applyStockDelta(Number(stock.quantity ?? 0), delta);
    await setStockQuantity(stock.id, salonId, quantityAfter);
    await insertInventoryMovement(salonId, {
      product_id: productId,
      location,
      movement_type: movementType,
      quantity_delta: delta,
      quantity_after: quantityAfter,
      reference_type: referenceType,
      reference_id: referenceId,
      note,
    });

    return { ok: true, value: { quantityAfter } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar stock.";
    return { ok: false, error: message };
  }
}
