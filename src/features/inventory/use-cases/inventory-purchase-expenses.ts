import { toAmount } from "@/infra/format/money";
import "server-only";

import { findInventoryPurchaseHistory } from "../data/inventory.repo";

export interface InventoryPurchaseExpenseHistoryItem {
  id: string;
  date: string;
  amount: number;
  commerceName: string | null;
  note: string | null;
  createdAt: string;
  detail: string;
}

export async function getInventoryPurchaseExpenseHistory(
  salonId: string
): Promise<InventoryPurchaseExpenseHistoryItem[]> {
  const purchases = await findInventoryPurchaseHistory(salonId);

  return purchases.map((purchase) => {
    const itemNames = (purchase.inventory_purchase_items ?? [])
      .map((item) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        return product?.name;
      })
      .filter(Boolean)
      .join(", ");

    return {
      id: purchase.id,
      date: purchase.purchase_date,
      amount: toAmount(purchase.total_cost),
      commerceName: purchase.supplier_name,
      note: purchase.note,
      createdAt: purchase.created_at,
      detail: itemNames || purchase.note || "Compra de productos",
    };
  });
}
