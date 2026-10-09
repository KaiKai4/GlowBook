// Paridad del historial y de los acumulados: el calculo JS que agregaba buckets antes de
// migrar a SQL (report_monthly_series, report_busy_hours, report_expense_concepts,
// report_product_sales, report_inventory_alerts, report_period_totals) se conserva AQUI
// solo como oraculo. Sobre un dataset pequeno, el view model que sale de los payloads SQL
// debe coincidir con el que produce ese calculo antiguo.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonReportIdentity, findSalonTimezone } from "../data/reports.repo";
import {
  fetchCommissionReport,
  fetchOperationalBreakdown,
  fetchPeriodTotals,
} from "../data/rpc/reports-read-models.rpc";
import {
  fetchBusyHours,
  fetchExpenseConcepts,
  fetchInventoryAlerts,
  fetchMonthlySeries,
  fetchProductSales,
  type MonthlySeriesRow,
  type ProductSalesRow,
  type ExpenseConceptRow,
  type InventoryAlertRow,
} from "../data/rpc/reports-history.rpc";
import {
  busyHourLabel,
  type HistoricalReportAnalytics,
  type LifetimeReportTotals,
  type MonthlyExportRow,
  type ReportModuleAvailability,
} from "../domain/analytics";
import { getOperationalReport } from "./get-operational-report";
import { getReportExportData } from "./get-report-export";

vi.mock("../data/reports.repo", () => ({
  findSalonReportIdentity: vi.fn(),
  findSalonTimezone: vi.fn(),
}));

vi.mock("../data/rpc/reports-read-models.rpc", () => ({
  fetchPeriodTotals: vi.fn(),
  fetchOperationalBreakdown: vi.fn(),
  fetchCommissionReport: vi.fn(),
}));

vi.mock("../data/rpc/reports-history.rpc", () => ({
  fetchMonthlySeries: vi.fn(),
  fetchBusyHours: vi.fn(),
  fetchExpenseConcepts: vi.fn(),
  fetchProductSales: vi.fn(),
  fetchInventoryAlerts: vi.fn(),
}));

// --- Oraculo: calculo JS anterior sobre buckets crudos (no es codigo de produccion). ---

interface OracleInventoryLocation {
  location: "retail" | "internal" | "storage";
  quantity: number;
  minimumQuantity: number;
}

interface OracleInput {
  appointmentMonths: Array<{ monthKey: string; completedRevenue: number; completedCount: number }>;
  busyHours: Array<{ hour: number; total: number }>;
  retailMonths: Array<{ monthKey: string; amount: number }>;
  expenseGroups: Array<{ monthKey: string; label: string; amount: number }>;
  purchaseMonths: Array<{ monthKey: string; amount: number }>;
  productMonths: Array<{ productId: string; productName: string; monthKey: string; quantity: number }>;
  inventoryProducts: Array<{ id: string; name: string; locations: OracleInventoryLocation[] }>;
  modules: ReportModuleAvailability;
}

function oracleInventoryAlert(product: OracleInput["inventoryProducts"][number]): InventoryAlertRow {
  const quantities = { retail: 0, internal: 0, storage: 0 };
  let minimum = 0;
  for (const location of product.locations) {
    quantities[location.location] += location.quantity;
    minimum += location.minimumQuantity;
  }
  const total = quantities.retail + quantities.internal + quantities.storage;
  const state = total <= 0 ? "agotado" : total <= minimum ? "bajo" : "disponible";
  return { id: product.id, name: product.name, ...quantities, total, minimum, state };
}

function oracleHistorical(
  input: OracleInput,
  months: Array<{ monthKey: string; label: string }>
): HistoricalReportAnalytics {
  const { modules } = input;
  const monthly = new Map(
    months.map((month) => [
      month.monthKey,
      { ...month, appointmentRevenue: 0, retailRevenue: 0, operationalExpenses: 0, inventoryPurchases: 0, completedAppointments: 0 },
    ])
  );
  for (const bucket of input.appointmentMonths) {
    const month = monthly.get(bucket.monthKey);
    if (month) {
      month.appointmentRevenue += bucket.completedRevenue;
      month.completedAppointments += bucket.completedCount;
    }
  }
  if (modules.retail) {
    for (const bucket of input.retailMonths) {
      const month = monthly.get(bucket.monthKey);
      if (month) month.retailRevenue += bucket.amount;
    }
  }
  if (modules.expenses) {
    for (const group of input.expenseGroups) {
      const month = monthly.get(group.monthKey);
      if (month) month.operationalExpenses += group.amount;
    }
  }
  if (modules.inventory) {
    for (const bucket of input.purchaseMonths) {
      const month = monthly.get(bucket.monthKey);
      if (month) month.inventoryPurchases += bucket.amount;
    }
  }
  const monthPoints = [...monthly.values()].map((month) => {
    const totalRevenue = month.appointmentRevenue + month.retailRevenue;
    const totalExpenses = month.operationalExpenses + month.inventoryPurchases;
    const profit = totalRevenue - totalExpenses;
    return { ...month, totalRevenue, totalExpenses, profit, marginPct: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0 };
  });

  const productMap = new Map<string, { id: string; name: string; total: number; monthTotals: Map<string, number> }>();
  if (modules.retail) {
    for (const bucket of input.productMonths) {
      if (!monthly.has(bucket.monthKey)) continue;
      const product = productMap.get(bucket.productId) ?? {
        id: bucket.productId,
        name: bucket.productName,
        total: 0,
        monthTotals: new Map<string, number>(),
      };
      product.total += bucket.quantity;
      product.monthTotals.set(bucket.monthKey, (product.monthTotals.get(bucket.monthKey) ?? 0) + bucket.quantity);
      productMap.set(bucket.productId, product);
    }
  }

  const grouped = new Map<string, number>();
  if (modules.expenses) {
    for (const group of input.expenseGroups) grouped.set(group.label, (grouped.get(group.label) ?? 0) + group.amount);
  }
  if (modules.inventory) {
    const restockTotal = input.purchaseMonths.reduce((sum, bucket) => sum + bucket.amount, 0);
    if (restockTotal > 0) grouped.set("Reposiciones de inventario", restockTotal);
  }

  return {
    months: monthPoints,
    busyHours: [...input.busyHours]
      .sort((a, b) => a.hour - b.hour)
      .map((bucket) => ({ hour: bucket.hour, label: busyHourLabel(bucket.hour), total: bucket.total })),
    productSales: [...productMap.values()]
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        name: product.name,
        total: product.total,
        months: months.map((month) => product.monthTotals.get(month.monthKey) ?? 0),
      })),
    topExpenses: [...grouped.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
      .slice(0, 5),
    inventoryAlerts: modules.inventory
      ? input.inventoryProducts
          .map(oracleInventoryAlert)
          .filter((product) => product.state !== "disponible")
          .sort((a, b) => a.total - b.total || a.name.localeCompare(b.name))
      : [],
  };
}

function oracleLifetime(input: OracleInput): LifetimeReportTotals {
  const appointmentRevenue = input.appointmentMonths.reduce((sum, bucket) => sum + bucket.completedRevenue, 0);
  const completedAppointments = input.appointmentMonths.reduce((sum, bucket) => sum + bucket.completedCount, 0);
  const retailRevenue = input.modules.retail ? input.retailMonths.reduce((sum, bucket) => sum + bucket.amount, 0) : 0;
  const operationalExpenses = input.modules.expenses ? input.expenseGroups.reduce((sum, group) => sum + group.amount, 0) : 0;
  const inventoryPurchases = input.modules.inventory ? input.purchaseMonths.reduce((sum, bucket) => sum + bucket.amount, 0) : 0;
  const grossRevenue = appointmentRevenue + retailRevenue;
  const totalExpenses = operationalExpenses + inventoryPurchases;
  return {
    appointmentRevenue,
    retailRevenue,
    grossRevenue,
    operationalExpenses,
    inventoryPurchases,
    totalExpenses,
    estimatedProfit: grossRevenue - totalExpenses,
    completedAppointments,
  };
}

function oracleExportRows(input: OracleInput, currentMonthKey: string): MonthlyExportRow[] {
  const { modules } = input;
  const keys = [
    ...input.appointmentMonths.map((bucket) => bucket.monthKey),
    ...(modules.retail ? input.retailMonths.map((bucket) => bucket.monthKey) : []),
    ...(modules.expenses ? input.expenseGroups.map((group) => group.monthKey) : []),
    ...(modules.inventory ? input.purchaseMonths.map((bucket) => bucket.monthKey) : []),
  ];
  if (keys.length === 0) return [];
  const firstKey = keys.reduce((min, key) => (key < min ? key : min));
  const lastKey = keys.reduce((max, key) => (key > max ? key : max), currentMonthKey);

  const rows = new Map<string, MonthlyExportRow>();
  const [firstYear = NaN, firstMonth = NaN] = firstKey.split("-").map(Number);
  const [lastYear = NaN, lastMonth = NaN] = lastKey.split("-").map(Number);
  for (let absolute = firstYear * 12 + firstMonth - 1; absolute <= lastYear * 12 + lastMonth - 1; absolute += 1) {
    const monthKey = `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, "0")}`;
    rows.set(monthKey, {
      monthKey,
      completedAppointments: 0,
      appointmentRevenue: 0,
      retailRevenue: 0,
      grossRevenue: 0,
      operationalExpenses: 0,
      inventoryPurchases: 0,
      totalExpenses: 0,
      profit: 0,
    });
  }
  for (const bucket of input.appointmentMonths) {
    const row = rows.get(bucket.monthKey);
    if (row) {
      row.completedAppointments += bucket.completedCount;
      row.appointmentRevenue += bucket.completedRevenue;
    }
  }
  for (const bucket of modules.retail ? input.retailMonths : []) {
    const row = rows.get(bucket.monthKey);
    if (row) row.retailRevenue += bucket.amount;
  }
  for (const group of modules.expenses ? input.expenseGroups : []) {
    const row = rows.get(group.monthKey);
    if (row) row.operationalExpenses += group.amount;
  }
  for (const bucket of modules.inventory ? input.purchaseMonths : []) {
    const row = rows.get(bucket.monthKey);
    if (row) row.inventoryPurchases += bucket.amount;
  }
  return [...rows.values()].map((row) => {
    const grossRevenue = row.appointmentRevenue + row.retailRevenue;
    const totalExpenses = row.operationalExpenses + row.inventoryPurchases;
    return { ...row, grossRevenue, totalExpenses, profit: grossRevenue - totalExpenses };
  });
}

// --- Dataset pequeno: mayo y junio 2026. ---

const WINDOW = [
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
];
const NOW = new Date("2026-06-15T12:00:00.000Z");
const ALL: ReportModuleAvailability = { inventory: true, retail: true, expenses: true };

const DATASET: OracleInput = {
  appointmentMonths: [
    { monthKey: "2026-05", completedRevenue: 150, completedCount: 2 },
    { monthKey: "2026-06", completedRevenue: 70, completedCount: 1 },
  ],
  busyHours: [
    { hour: 15, total: 1 },
    { hour: 10, total: 2 },
  ],
  retailMonths: [{ monthKey: "2026-05", amount: 50 }],
  expenseGroups: [
    { monthKey: "2026-05", label: "Alquiler", amount: 150 },
    { monthKey: "2026-06", label: "Luz", amount: 40 },
  ],
  purchaseMonths: [{ monthKey: "2026-06", amount: 30 }],
  productMonths: [
    { productId: "p1", productName: "Shampoo", monthKey: "2026-05", quantity: 3 },
    { productId: "p1", productName: "Shampoo", monthKey: "2026-06", quantity: 2 },
    { productId: "p2", productName: "Crema", monthKey: "2026-06", quantity: 4 },
  ],
  inventoryProducts: [
    { id: "p1", name: "Shampoo", locations: [{ location: "retail", quantity: 1, minimumQuantity: 2 }] },
    { id: "p2", name: "Crema", locations: [{ location: "retail", quantity: 10, minimumQuantity: 3 }] },
    { id: "p3", name: "Tinte", locations: [{ location: "internal", quantity: 0, minimumQuantity: 0 }] },
  ],
  modules: ALL,
};

// --- Payloads SQL derivados a mano del dataset (lo que devuelven las funciones de 066). ---

function zeroRow(monthKey: string): MonthlySeriesRow {
  return {
    monthKey,
    completedAppointments: 0,
    appointmentRevenue: 0,
    retailRevenue: 0,
    grossRevenue: 0,
    operationalExpenses: 0,
    inventoryPurchases: 0,
    totalExpenses: 0,
    profit: 0,
    marginPct: 0,
  };
}

const SQL_SERIES_WINDOW: MonthlySeriesRow[] = WINDOW.map((monthKey) => {
  if (monthKey === "2026-05") {
    return { ...zeroRow(monthKey), completedAppointments: 2, appointmentRevenue: 150, retailRevenue: 50, grossRevenue: 200, operationalExpenses: 150, totalExpenses: 150, profit: 50, marginPct: 25 };
  }
  if (monthKey === "2026-06") {
    return { ...zeroRow(monthKey), completedAppointments: 1, appointmentRevenue: 70, grossRevenue: 70, operationalExpenses: 40, inventoryPurchases: 30, totalExpenses: 70, profit: 0, marginPct: 0 };
  }
  return zeroRow(monthKey);
});

function monthCounts(counts: Record<string, number>): number[] {
  return WINDOW.map((monthKey) => counts[monthKey] ?? 0);
}

const SQL_BUSY_HOURS = [
  { hour: 10, total: 2 },
  { hour: 15, total: 1 },
];
const SQL_TOP_EXPENSES_WITH_RESTOCK: ExpenseConceptRow[] = [
  { label: "Alquiler", amount: 150 },
  { label: "Luz", amount: 40 },
  { label: "Reposiciones de inventario", amount: 30 },
];
const SQL_TOP_EXPENSES_NO_RESTOCK: ExpenseConceptRow[] = [
  { label: "Alquiler", amount: 150 },
  { label: "Luz", amount: 40 },
];
const SQL_PRODUCTS: ProductSalesRow[] = [
  { id: "p1", name: "Shampoo", total: 5, months: monthCounts({ "2026-05": 3, "2026-06": 2 }) },
  { id: "p2", name: "Crema", total: 4, months: monthCounts({ "2026-06": 4 }) },
];
const SQL_ALERTS: InventoryAlertRow[] = [
  { id: "p3", name: "Tinte", retail: 0, internal: 0, storage: 0, total: 0, minimum: 0, state: "agotado" },
  { id: "p1", name: "Shampoo", retail: 1, internal: 0, storage: 0, total: 1, minimum: 2, state: "bajo" },
];
const SQL_PERIOD_TOTALS = {
  revenue: 220,
  discounts: 0,
  retailRevenue: 50,
  grossRevenue: 270,
  manualExpenses: 190,
  inventoryPurchases: 30,
  totalExpenses: 220,
  estimatedProfit: 50,
  completedCount: 3,
  totalCount: 3,
  avgTicket: 220 / 3,
  noShowRate: 0,
  newCustomers: 0,
};

const mockedSeries = vi.mocked(fetchMonthlySeries);
const mockedBusy = vi.mocked(fetchBusyHours);
const mockedExpenses = vi.mocked(fetchExpenseConcepts);
const mockedProducts = vi.mocked(fetchProductSales);
const mockedAlerts = vi.mocked(fetchInventoryAlerts);
const mockedTotals = vi.mocked(fetchPeriodTotals);

/** Mocks de SQL para el reporte operativo (ventana de 12 meses y acumulado del año). */
function useOperationalSql(): void {
  mockedSeries.mockImplementation(async ({ firstMonth }) =>
    firstMonth === "2025-07" ? SQL_SERIES_WINDOW : []
  );
  mockedBusy.mockResolvedValue(SQL_BUSY_HOURS);
  mockedExpenses.mockImplementation(async ({ includeRestock }) =>
    includeRestock ? SQL_TOP_EXPENSES_WITH_RESTOCK : SQL_TOP_EXPENSES_NO_RESTOCK
  );
  mockedProducts.mockResolvedValue(SQL_PRODUCTS);
  mockedAlerts.mockResolvedValue(SQL_ALERTS);
  mockedTotals.mockResolvedValue(SQL_PERIOD_TOTALS);
}

describe("paridad SQL vs oraculo JS del historial y acumulados", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(findSalonTimezone).mockResolvedValue("UTC");
    vi.mocked(findSalonReportIdentity).mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2025-01-01T00:00:00.000Z",
    });
    vi.mocked(fetchOperationalBreakdown).mockResolvedValue({ statusBreakdown: [], byEmployee: [], byService: [] });
    vi.mocked(fetchCommissionReport).mockResolvedValue({ rows: [], totalRevenue: 0, totalCommission: 0 });
  });

  it("el historial de 12 meses (graficas y alertas) coincide con el oraculo JS", async () => {
    useOperationalSql();

    const report = await getOperationalReport({ salonId: "salon-1", filters: { preset: "mes" }, now: NOW });
    const labels = report.analytics.months.map((month) => ({ monthKey: month.monthKey, label: month.label }));

    expect(report.analytics).toEqual(oracleHistorical(DATASET, labels));
  });

  it("el acumulado del año coincide con el oraculo JS de totales", async () => {
    useOperationalSql();

    const report = await getOperationalReport({ salonId: "salon-1", filters: { preset: "mes" }, now: NOW });

    expect(report.selectedYear).toBe(2026);
    expect(report.yearly).toEqual(oracleLifetime(DATASET));
  });

  it("la exportacion del historico coincide con el oraculo: filas mensuales, totales y conceptos", async () => {
    // Serie lifetime: meses vacios antes y despues de los movimientos (se recortan en la exportacion).
    mockedSeries.mockResolvedValue([
      zeroRow("2026-04"),
      ...SQL_SERIES_WINDOW.filter((row) => row.monthKey === "2026-05" || row.monthKey === "2026-06"),
      zeroRow("2026-07"),
    ]);
    mockedExpenses.mockResolvedValue(SQL_TOP_EXPENSES_NO_RESTOCK);
    mockedProducts.mockResolvedValue(SQL_PRODUCTS);
    mockedTotals.mockResolvedValue(SQL_PERIOD_TOTALS);

    const data = await getReportExportData("salon-1", ALL, { type: "lifetime" }, NOW);

    expect(data.months).toEqual(oracleExportRows(DATASET, "2026-06").map((row) => ({ ...row, label: expect.any(String) })));
    expect(data.totals).toEqual(oracleLifetime(DATASET));
    expect(data.expenseConcepts).toEqual([
      { label: "Alquiler", amount: 150 },
      { label: "Luz", amount: 40 },
    ]);
    expect(data.productTotals).toEqual([
      { name: "Shampoo", quantity: 5 },
      { name: "Crema", quantity: 4 },
    ]);
  });

  it("la exportacion anual rellena hasta diciembre desde el primer mes con movimientos", async () => {
    // Serie del año 2026 completo: enero a abril en cero, mayo y junio con movimientos.
    const yearKeys = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}`);
    mockedSeries.mockResolvedValue(
      yearKeys.map((monthKey) => SQL_SERIES_WINDOW.find((row) => row.monthKey === monthKey) ?? zeroRow(monthKey))
    );
    mockedExpenses.mockResolvedValue(SQL_TOP_EXPENSES_NO_RESTOCK);
    mockedProducts.mockResolvedValue(SQL_PRODUCTS);
    mockedTotals.mockResolvedValue(SQL_PERIOD_TOTALS);

    const data = await getReportExportData("salon-1", ALL, { type: "year", year: 2026 }, NOW);
    const expected = oracleExportRows(DATASET, "2026-12");

    expect(data.months).toEqual(expected.map((row) => ({ ...row, label: expect.any(String) })));
    expect(data.months.at(-1)?.monthKey).toBe("2026-12");
  });

  it("con el modulo de tienda apagado, ventas y retail quedan en cero igual que el oraculo", async () => {
    const modules = { inventory: true, retail: false, expenses: true };
    const noRetailDataset: OracleInput = { ...DATASET, retailMonths: [], productMonths: [], modules };
    // Con retail apagado, SQL pone la columna de vitrina en cero y recalcula ingresos y beneficio.
    const noRetailSeries = SQL_SERIES_WINDOW.filter((row) => ["2026-04", "2026-05", "2026-06"].includes(row.monthKey)).map(
      (row) => {
        const grossRevenue = row.appointmentRevenue;
        const profit = grossRevenue - row.totalExpenses;
        return {
          ...row,
          retailRevenue: 0,
          grossRevenue,
          profit,
          marginPct: grossRevenue > 0 ? (profit * 100) / grossRevenue : 0,
        };
      }
    );
    mockedSeries.mockResolvedValue(noRetailSeries);
    mockedExpenses.mockResolvedValue(SQL_TOP_EXPENSES_NO_RESTOCK);
    mockedProducts.mockResolvedValue([]);
    mockedTotals.mockResolvedValue({ ...SQL_PERIOD_TOTALS, retailRevenue: 0, grossRevenue: 220, estimatedProfit: 0 });

    const data = await getReportExportData("salon-1", modules, { type: "lifetime" }, NOW);

    expect(data.totals).toEqual(oracleLifetime(noRetailDataset));
    expect(data.months.map((row) => row.monthKey)).toEqual(
      oracleExportRows(noRetailDataset, "2026-06").map((row) => row.monthKey)
    );
  });
});
