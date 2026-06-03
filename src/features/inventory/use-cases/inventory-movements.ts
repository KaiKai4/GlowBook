import "server-only";

import type { Result } from "@/lib/result";
import {
  insertInventoryPurchase,
  insertInventoryPurchaseItem,
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
  const out = await adjustInventoryStock({
    salonId,
    productId: input.product_id,
    location: input.from_location,
    delta: -input.quantity,
    movementType: "transfer_out",
    note: input.note,
  });
  if (!out.ok) return out;

  const into = await adjustInventoryStock({
    salonId,
    productId: input.product_id,
    location: input.to_location,
    delta: input.quantity,
    movementType: "transfer_in",
    note: input.note,
  });
  return into.ok ? { ok: true, value: undefined } : into;
}

export async function recordInventoryPurchase(
  salonId: string,
  input: InventoryPurchaseInput
): Promise<Result<void>> {
  const totalCost = Math.round(input.quantity * input.unit_cost * 100) / 100;

  try {
    const purchase = await insertInventoryPurchase(salonId, {
      supplier_name: input.supplier_name,
      purchase_date: input.purchase_date,
      total_cost: totalCost,
      note: input.note,
    });
    await insertInventoryPurchaseItem(salonId, {
      purchase_id: purchase.id,
      product_id: input.product_id,
      location: input.location,
      quantity: input.quantity,
      unit_cost: input.unit_cost,
      total_cost: totalCost,
    });

    const stock = await adjustInventoryStock({
      salonId,
      productId: input.product_id,
      location: input.location,
      delta: input.quantity,
      movementType: "purchase",
      note: input.note || input.supplier_name,
      referenceType: "inventory_purchase",
      referenceId: purchase.id,
    });

    return stock.ok ? { ok: true, value: undefined } : stock;
  } catch {
    return { ok: false, error: "Error al registrar la reposición." };
  }
}
