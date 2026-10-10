import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { err, type Result } from "@/infra/result";
import { canTransferToLocation, transferFromStorage } from "../domain/transfer-rules";
import type { CreateInventoryProductInput, InventoryTransferInput } from "../schemas";
import { transferInventoryStock } from "./inventory-movements";
import { createInventoryProduct, getInventoryPage } from "./inventory-products";

// Escrituras de productos y stock con sus cupos del plan. Las acciones solo
// validan y orquestan; el orden es: modulo habilitado -> cupo -> regla de negocio.

export async function createInventoryProductWithPlanLimits(
  salonId: string,
  input: CreateInventoryProductInput
): Promise<Result<void>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "inventory" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await checkPlanLimit({ salonId, metricKey: "inventory.products" });
  if (!limit.ok) return err(limit.error);

  return createInventoryProduct(salonId, input);
}

export async function transferInventoryStockWithPlanLimits(
  salonId: string,
  input: InventoryTransferInput
): Promise<Result<void>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "inventory" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await checkPlanLimit({ salonId, metricKey: "inventory.movements" });
  if (!limit.ok) return err(limit.error);

  const transfer = transferFromStorage(input);
  const inventory = await getInventoryPage(salonId);
  const product = inventory.products.find((item) => item.id === transfer.product_id);
  if (!product) return err("Producto inválido.");
  if (!canTransferToLocation(product, transfer.to_location)) {
    return err("Este producto solo puede transferirse de Bodega a Uso interno.");
  }

  return transferInventoryStock(salonId, transfer, transfer.idempotency_key);
}
