import "server-only";

import { toPublicErrorMessage } from "@/lib/errors";
import type { Result } from "@/lib/result";
import {
  recordInventoryPurchaseAtomically,
  transferInventoryStockAtomically,
} from "../data/inventory.repo";
import type {
  InventoryPurchaseInput,
  InventoryTransferInput,
} from "../schemas";

export async function transferInventoryStock(
  salonId: string,
  input: InventoryTransferInput
): Promise<Result<void>> {
  try {
    await transferInventoryStockAtomically(salonId, input);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error, "Error al transferir stock.") };
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
    return { ok: false, error: toPublicErrorMessage(error, "Error al registrar la reposicion.") };
  }
}
