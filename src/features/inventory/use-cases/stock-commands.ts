import "server-only";

import { getErrorMessage } from "@/lib/errors";
import type { Result } from "@/lib/result";
import type { InventoryLocation } from "../domain/stock";
import { applyInventoryStockDelta } from "../data/inventory.repo";

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
    const result = await applyInventoryStockDelta(salonId, {
      product_id: productId,
      location,
      delta,
      movement_type: movementType,
      reference_type: referenceType,
      reference_id: referenceId,
      note,
    });

    return { ok: true, value: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Error al actualizar stock.") };
  }
}
