// Punto publico del modulo inventory. Otros modulos importan solo desde aqui.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { InventoryLocationSchema, type InventoryPurchaseInput } from "./schemas";
export { recordInventoryPurchase } from "./use-cases/inventory-movements";
export { getInventoryPurchaseExpenseHistory } from "./use-cases/inventory-purchase-expenses";
export {
  getRetailInventoryProducts,
  type RetailInventoryProductView,
} from "./use-cases/retail-inventory-products";

export { getInventoryProductOptions } from "./use-cases/inventory-product-options";
export { deleteInventoryProduct, updateInventoryProductProfile, getInventoryPage } from "./use-cases/inventory-products";
export { createInventoryProductWithPlanLimits, transferInventoryStockWithPlanLimits } from "./use-cases/manage-inventory-products";
