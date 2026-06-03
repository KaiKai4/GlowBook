import "server-only";

import { sumExpensesTotal } from "@/features/expenses/data/expenses.repo";
import { sumInventoryPurchasesTotal } from "@/features/inventory/data/inventory.repo";
import { sumRetailSalesTotal } from "@/features/retail/data/retail.repo";

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
    sumRetailSalesTotal(salonId, fromIso, toIso),
    sumExpensesTotal(salonId, fromDate, toDate),
    sumInventoryPurchasesTotal(salonId, fromDate, toDate),
  ]);

  return {
    retailRevenue,
    manualExpenses,
    inventoryPurchases,
  };
}
