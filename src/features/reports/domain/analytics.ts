import { formatLocalDateISO } from "@/lib/utils/dates";

export interface AnalyticsAppointment {
  status: string;
  totalPrice: number;
  startTime: string | null;
}

export interface AnalyticsMoneyRow {
  date: string;
  amount: number;
}

export interface AnalyticsExpenseRow extends AnalyticsMoneyRow {
  label: string;
}

export interface AnalyticsRetailItem {
  date: string;
  productId: string;
  productName: string;
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
  appointments: AnalyticsAppointment[];
  retailSales: AnalyticsMoneyRow[];
  expenses: AnalyticsExpenseRow[];
  inventoryPurchases: AnalyticsMoneyRow[];
  retailItems: AnalyticsRetailItem[];
  inventoryProducts: InventoryAlertProduct[];
  months: Array<{ monthKey: string; label: string }>;
  timezone: string;
  modules: ReportModuleAvailability;
}

function monthKeyFromTimestamp(value: string, timezone: string): string {
  return formatLocalDateISO(new Date(value), timezone).slice(0, 7);
}

function hourLabel(hour: number): string {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "numeric",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour)));
}

function appointmentHour(value: string, timezone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(value))
    .find((part) => part.type === "hour")?.value;

  const parsed = Number(hour ?? 0);
  return parsed === 24 ? 0 : parsed;
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
  appointments,
  retailSales,
  expenses,
  inventoryPurchases,
  retailItems,
  inventoryProducts,
  months,
  timezone,
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
  const busyHours = new Map<number, number>();

  for (const appointment of appointments) {
    if (!appointment.startTime) continue;
    const month = monthly.get(monthKeyFromTimestamp(appointment.startTime, timezone));
    if (appointment.status === "completed" && month) {
      month.appointmentRevenue += appointment.totalPrice;
      month.completedAppointments += 1;
    }
    if (!["cancelled", "no_show"].includes(appointment.status)) {
      const hour = appointmentHour(appointment.startTime, timezone);
      busyHours.set(hour, (busyHours.get(hour) ?? 0) + 1);
    }
  }

  if (modules.retail) {
    for (const sale of retailSales) {
      const month = monthly.get(monthKeyFromTimestamp(sale.date, timezone));
      if (month) month.retailRevenue += sale.amount;
    }
  }

  if (modules.expenses) {
    for (const expense of expenses) {
      const month = monthly.get(expense.date.slice(0, 7));
      if (month) month.operationalExpenses += expense.amount;
    }
  }

  if (modules.inventory) {
    for (const purchase of inventoryPurchases) {
      const month = monthly.get(purchase.date.slice(0, 7));
      if (month) month.inventoryPurchases += purchase.amount;
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
    for (const item of retailItems) {
      const monthKey = monthKeyFromTimestamp(item.date, timezone);
      if (!monthly.has(monthKey)) continue;
      const product = productMap.get(item.productId) ?? {
        id: item.productId,
        name: item.productName,
        total: 0,
        monthTotals: new Map<string, number>(),
      };
      product.total += item.quantity;
      product.monthTotals.set(monthKey, (product.monthTotals.get(monthKey) ?? 0) + item.quantity);
      productMap.set(item.productId, product);
    }
  }

  const groupedExpenses = new Map<string, number>();
  if (modules.expenses) {
    for (const expense of expenses) {
      groupedExpenses.set(expense.label, (groupedExpenses.get(expense.label) ?? 0) + expense.amount);
    }
  }
  if (modules.inventory) {
    const restockTotal = inventoryPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    if (restockTotal > 0) groupedExpenses.set("Reposiciones de inventario", restockTotal);
  }

  return {
    months: monthPoints,
    busyHours: [...busyHours.entries()]
      .map(([hour, total]) => ({ hour, label: hourLabel(hour), total }))
      .sort((a, b) => a.hour - b.hour),
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
