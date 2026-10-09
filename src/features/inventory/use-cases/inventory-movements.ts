import "server-only";

import { toPublicErrorMessage } from "@/infra/errors";
import type { Result } from "@/infra/result";
import { recordInventoryPurchaseRpc } from "../data/rpc/record-inventory-purchase";
import { recordInventoryTransferRpc } from "../data/rpc/record-inventory-transfer";
import type { InventoryPurchaseInput, InventoryTransferInput } from "../schemas";

/** Mueve stock. idempotencyKey evita aplicar dos veces un reenvio del mismo formulario. */
export async function transferInventoryStock(
  salonId: string,
  input: InventoryTransferInput,
  idempotencyKey: string
): Promise<Result<void>> {
  try {
    await recordInventoryTransferRpc({
      salonId,
      productId: input.product_id,
      fromLocation: input.from_location,
      toLocation: input.to_location,
      quantity: input.quantity,
      note: input.note || null,
      idempotencyKey,
    });
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error, "Error al transferir stock.") };
  }
}

/** Registra una reposicion. idempotencyKey evita duplicar la compra si el formulario se reenvia. */
export async function recordInventoryPurchase(
  salonId: string,
  input: InventoryPurchaseInput,
  idempotencyKey: string
): Promise<Result<void>> {
  try {
    await recordInventoryPurchaseRpc({
      salonId,
      supplierName: input.supplier_name || null,
      purchaseDate: input.purchase_date,
      productId: input.product_id,
      quantity: input.quantity,
      unitCost: input.unit_cost,
      note: input.note || null,
      idempotencyKey,
    });

    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error, "Error al registrar la reposicion.") };
  }
}
