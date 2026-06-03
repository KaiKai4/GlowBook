import "server-only";

import { getErrorMessage } from "@/lib/errors";
import type { Result } from "@/lib/result";
import {
  recordInventoryPurchaseAtomically,
  transferInventoryStockAtomically,
} from "../data/inventory.repo";
import type {
  InventoryMovementInput,
  InventoryPurchaseInput,
  InventoryTransferInput,
} from "../schemas";
import { adjustInventoryStock } from "./stock-commands";

export async function recordInventoryMovement(
  salonId: string,
  input: InventoryMovementInput
): Promise<Result<void>> {
  const delta =
    input.movement_kind === "entry"
      ? input.quantity
      : -input.quantity;
  const movementType =
    input.movement_kind === "entry"
      ? "adjustment"
      : "internal_use";

  const result = await adjustInventoryStock({
    salonId,
    productId: input.product_id,
    location: input.location,
    delta,
    movementType,
    note: input.note,
  });

  return result.ok ? { ok: true, value: undefined } : result;
}

export async function transferInventoryStock(
  salonId: string,
  input: InventoryTransferInput
): Promise<Result<void>> {
  try {
    await transferInventoryStockAtomically(salonId, input);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Error al transferir stock.") };
  }
}

export async function recordInventoryPurchase(
  salonId: string,
  input: InventoryPurchaseInput
): Promise<Result<void>> {
  try {
    await recordInventoryPurchaseAtomically(salonId, {
      supplier_name: input.supplier_name,
      purchase_date: input.purchase_date,
      product_id: input.product_id,
      quantity: input.quantity,
      unit_cost: input.unit_cost,
      note: input.note,
    });

    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Error al registrar la reposicion.") };
  }
}
