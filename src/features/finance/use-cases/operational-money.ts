import "server-only";

import { getManualExpenseTotal } from "@/features/expenses/use-cases/manual-expense-total";
import { getInventoryPurchaseTotal } from "@/features/inventory/use-cases/inventory-purchase-total";
import { getRetailRevenueTotal } from "@/features/retail/use-cases/retail-revenue";

export interface OperationalMoneyRange {
  salonId: string;
  fromIso: string;
  toIso: string;
  fromDate: string;
  toDate: string;
}

export interface ExternalOperationalMoney {
  retailRevenue: number;
  manualExpenses: number;
  inventoryPurchases: number;
}

export async function getExternalOperationalMoney({
  salonId,
  fromIso,
  toIso,
  fromDate,
  toDate,
}: OperationalMoneyRange): Promise<ExternalOperationalMoney> {
  const [retailRevenue, manualExpenses, inventoryPurchases] = await Promise.all([
    getRetailRevenueTotal(salonId, fromIso, toIso),
    getManualExpenseTotal(salonId, fromDate, toDate),
    getInventoryPurchaseTotal(salonId, fromDate, toDate),
  ]);

  return {
    retailRevenue,
    manualExpenses,
    inventoryPurchases,
  };
}
