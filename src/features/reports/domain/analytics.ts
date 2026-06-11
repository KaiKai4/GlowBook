// Las entradas llegan ya agregadas desde SQL (RPC report_monthly_history):
// el bucketing por mes/hora se hace en la base, en la zona horaria del salon.
// Este dominio solo combina buckets en los puntos que consumen las graficas.

export interface AppointmentMonthBucket {
  monthKey: string;
  completedRevenue: number;
  completedCount: number;
}

export interface BusyHourBucket {
  hour: number;
  total: number;
}

export interface MonthAmountBucket {
  monthKey: string;
  amount: number;
}

export interface ExpenseGroupBucket {
  monthKey: string;
  label: string;
  amount: number;
}

export interface ProductMonthBucket {
  productId: string;
  productName: string;
  monthKey: string;
  quantity: number;
}

export interface InventoryAlertLocation {
  location: "retail" | "internal" | "storage";
  quantity: number;
  minimumQuantity: number;
}

export interface InventoryAlertProduct {
  id: string;
  name: string;
  isRetailEnabled: boolean;
  locations: InventoryAlertLocation[];
}

export interface ReportModuleAvailability {
  inventory: boolean;
  retail: boolean;
  expenses: boolean;
}

export interface ReportMonthPoint {
  monthKey: string;
  label: string;
  appointmentRevenue: number;
  retailRevenue: number;
  totalRevenue: number;
  operationalExpenses: number;
  inventoryPurchases: number;
  totalExpenses: number;
  profit: number;
  marginPct: number;
  completedAppointments: number;
}

export interface BusyHourPoint {
  hour: number;
  label: string;
  total: number;
}

export interface ProductMonthlySales {
  id: string;
  name: string;
  total: number;
  months: number[];
}

export interface TopExpense {
  label: string;
  amount: number;
}

export interface InventoryAlert {
  id: string;
  name: string;
  retail: number;
  internal: number;
  storage: number;
  total: number;
  minimum: number;
  state: "agotado" | "bajo" | "disponible";
}

export interface HistoricalReportAnalytics {
  months: ReportMonthPoint[];
  busyHours: BusyHourPoint[];
  productSales: ProductMonthlySales[];
  topExpenses: TopExpense[];
  inventoryAlerts: InventoryAlert[];
}

export interface HistoricalAnalyticsInput {
  appointmentMonths: AppointmentMonthBucket[];
  busyHours: BusyHourBucket[];
  retailMonths: MonthAmountBucket[];
  expenseGroups: ExpenseGroupBucket[];
  purchaseMonths: MonthAmountBucket[];
  productMonths: ProductMonthBucket[];
  inventoryProducts: InventoryAlertProduct[];
  months: Array<{ monthKey: string; label: string }>;
  modules: ReportModuleAvailability;
}

function hourLabel(hour: number): string {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "numeric",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour)));
}

function inventoryAlert(product: InventoryAlertProduct): InventoryAlert {
  const quantities = { retail: 0, internal: 0, storage: 0 };
  let minimum = 0;

  for (const location of product.locations) {
    quantities[location.location] += location.quantity;
    minimum += location.minimumQuantity;
  }

  const total = quantities.retail + quantities.internal + quantities.storage;
  const state = total <= 0 ? "agotado" : total <= minimum ? "bajo" : "disponible";

  return {
    id: product.id,
    name: product.name,
    ...quantities,
    total,
    minimum,
    state,
  };
}

export function calculateHistoricalReportAnalytics({
  appointmentMonths,
  busyHours,
  retailMonths,
  expenseGroups,
  purchaseMonths,
  productMonths,
  inventoryProducts,
  months,
  modules,
}: HistoricalAnalyticsInput): HistoricalReportAnalytics {
  const monthly = new Map(
    months.map((month) => [
      month.monthKey,
      {
        ...month,
        appointmentRevenue: 0,
        retailRevenue: 0,
        operationalExpenses: 0,
        inventoryPurchases: 0,
        completedAppointments: 0,
      },
    ])
  );

  for (const bucket of appointmentMonths) {
    const month = monthly.get(bucket.monthKey);
    if (month) {
      month.appointmentRevenue += bucket.completedRevenue;
      month.completedAppointments += bucket.completedCount;
    }
  }

  if (modules.retail) {
    for (const bucket of retailMonths) {
      const month = monthly.get(bucket.monthKey);
      if (month) month.retailRevenue += bucket.amount;
    }
  }

  if (modules.expenses) {
    for (const group of expenseGroups) {
      const month = monthly.get(group.monthKey);
      if (month) month.operationalExpenses += group.amount;
    }
  }

  if (modules.inventory) {
    for (const bucket of purchaseMonths) {
      const month = monthly.get(bucket.monthKey);
      if (month) month.inventoryPurchases += bucket.amount;
    }
  }

  const monthPoints = [...monthly.values()].map((month) => {
    const totalRevenue = month.appointmentRevenue + month.retailRevenue;
    const totalExpenses = month.operationalExpenses + month.inventoryPurchases;
    const profit = totalRevenue - totalExpenses;

    return {
      ...month,
      totalRevenue,
      totalExpenses,
      profit,
      marginPct: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
    };
  });

  const productMap = new Map<
    string,
    { id: string; name: string; total: number; monthTotals: Map<string, number> }
  >();
  if (modules.retail) {
    for (const bucket of productMonths) {
      if (!monthly.has(bucket.monthKey)) continue;
      const product = productMap.get(bucket.productId) ?? {
        id: bucket.productId,
        name: bucket.productName,
        total: 0,
        monthTotals: new Map<string, number>(),
      };
      product.total += bucket.quantity;
      product.monthTotals.set(
        bucket.monthKey,
        (product.monthTotals.get(bucket.monthKey) ?? 0) + bucket.quantity
      );
      productMap.set(bucket.productId, product);
    }
  }

  const groupedExpenses = new Map<string, number>();
  if (modules.expenses) {
    for (const group of expenseGroups) {
      groupedExpenses.set(group.label, (groupedExpenses.get(group.label) ?? 0) + group.amount);
    }
  }
  if (modules.inventory) {
    const restockTotal = purchaseMonths.reduce((sum, bucket) => sum + bucket.amount, 0);
    if (restockTotal > 0) groupedExpenses.set("Reposiciones de inventario", restockTotal);
  }

  return {
    months: monthPoints,
    busyHours: [...busyHours]
      .sort((a, b) => a.hour - b.hour)
      .map((bucket) => ({ hour: bucket.hour, label: hourLabel(bucket.hour), total: bucket.total })),
    productSales: [...productMap.values()]
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        name: product.name,
        total: product.total,
        months: months.map((month) => product.monthTotals.get(month.monthKey) ?? 0),
      })),
    topExpenses: [...groupedExpenses.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
      .slice(0, 5),
    inventoryAlerts: modules.inventory
      ? inventoryProducts
          .map(inventoryAlert)
          .filter((product) => product.state !== "disponible")
          .sort((a, b) => a.total - b.total || a.name.localeCompare(b.name))
      : [],
  };
}
