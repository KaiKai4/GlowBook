import "server-only";

import { sumRetailSalesTotal } from "../data/retail.repo";

export async function getRetailRevenueTotal(
  salonId: string,
  fromIso: string,
  toIso: string
): Promise<number> {
  return sumRetailSalesTotal(salonId, fromIso, toIso);
}
