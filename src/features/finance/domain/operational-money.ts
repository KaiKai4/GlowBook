export interface OperationalMoneySources {
  appointmentRevenue: number;
  retailRevenue: number;
  manualExpenses: number;
  inventoryPurchases: number;
}

export interface OperationalMoneyTotals extends OperationalMoneySources {
  grossRevenue: number;
  totalExpenses: number;
  estimatedProfit: number;
}

export function calculateOperationalMoneyTotals(
  sources: OperationalMoneySources
): OperationalMoneyTotals {
  const grossRevenue = sources.appointmentRevenue + sources.retailRevenue;
  const totalExpenses = sources.manualExpenses + sources.inventoryPurchases;

  return {
    ...sources,
    grossRevenue,
    totalExpenses,
    estimatedProfit: grossRevenue - totalExpenses,
  };
}
