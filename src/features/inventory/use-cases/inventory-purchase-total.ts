import "server-only";

import { sumInventoryPurchasesTotal } from "../data/inventory.repo";

export async function getInventoryPurchaseTotal(
  salonId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  return sumInventoryPurchasesTotal(salonId, fromDate, toDate);
}
