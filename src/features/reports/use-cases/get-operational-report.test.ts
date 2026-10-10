import { beforeEach, describe, expect, it, vi } from "vitest";
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
} from "../data/rpc/reports-history.rpc";
import { findSalonReportIdentity } from "../data/reports.repo";
import { getOperationalReport } from "./get-operational-report";

vi.mock("../data/reports.repo", () => ({
  findSalonReportIdentity: vi.fn(),
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

const mockedTotals = vi.mocked(fetchPeriodTotals);
const mockedBreakdown = vi.mocked(fetchOperationalBreakdown);
const mockedCommissions = vi.mocked(fetchCommissionReport);
const mockedSeries = vi.mocked(fetchMonthlySeries);
const mockedBusyHours = vi.mocked(fetchBusyHours);
const mockedExpenses = vi.mocked(fetchExpenseConcepts);
const mockedProducts = vi.mocked(fetchProductSales);
const mockedAlerts = vi.mocked(fetchInventoryAlerts);
const mockedIdentity = vi.mocked(findSalonReportIdentity);

const NOW = new Date("2026-06-03T12:00:00.000Z");
// Ventana de 12 meses que termina en el mes actual (2026-06).
const WINDOW_MONTHS = [
  "2025-07",
  "2025-08",
  "2025-09",
  "2025-10",
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
];

const EMPTY_TOTALS = {
  revenue: 0,
  discounts: 0,
  retailRevenue: 0,
  grossRevenue: 0,
  manualExpenses: 0,
  inventoryPurchases: 0,
  totalExpenses: 0,
  estimatedProfit: 0,
  completedCount: 0,
  totalCount: 0,
  avgTicket: 0,
  noShowRate: 0,
  newCustomers: 0,
};

function zeroSeries() {
  return WINDOW_MONTHS.map((monthKey) => ({
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
  }));
}

describe("get operational report", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    mockedSeries.mockResolvedValue(zeroSeries());
    mockedBusyHours.mockResolvedValue([]);
    mockedExpenses.mockResolvedValue([]);
    mockedProducts.mockResolvedValue([]);
    mockedAlerts.mockResolvedValue([]);
    mockedTotals.mockResolvedValue({
      ...EMPTY_TOTALS,
      revenue: 100,
      discounts: 5,
      retailRevenue: 25,
      grossRevenue: 125,
      manualExpenses: 10,
      inventoryPurchases: 15,
      totalExpenses: 25,
      estimatedProfit: 100,
      completedCount: 1,
      totalCount: 2,
      avgTicket: 100,
      noShowRate: 0,
      newCustomers: 2,
    });
    mockedBreakdown.mockResolvedValue({ statusBreakdown: [], byEmployee: [], byService: [] });
    mockedCommissions.mockResolvedValue({ rows: [], totalRevenue: 0, totalCommission: 0 });
  });

  it("combines the SQL period totals with the breakdowns and commissions of the same range", async () => {
    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes", from: "2026-06-01", to: "2026-06-03" },
      now: new Date("2026-06-03T12:00:00.000Z"),
    });

    expect(report.revenue).toBe(100);
    expect(report.retailRevenue).toBe(25);
    expect(report.grossRevenue).toBe(125);
    expect(report.manualExpenses).toBe(10);
    expect(report.inventoryPurchases).toBe(15);
    expect(report.totalExpenses).toBe(25);
    expect(report.estimatedProfit).toBe(100);
    expect(report.newCustomers).toBe(2);
    expect(report.preset).toBe("custom");
    expect(mockedTotals).toHaveBeenCalledWith({
      from: "2026-06-01",
      to: "2026-06-03",
      timezone: "UTC",
      modules: { inventory: true, retail: true, expenses: true },
    });
    expect(mockedBreakdown).toHaveBeenCalledWith({ from: "2026-06-01", to: "2026-06-03", timezone: "UTC" });
    expect(mockedCommissions).toHaveBeenCalledWith({ from: "2026-06-01", to: "2026-06-03", timezone: "UTC" });
  });

  it("defaults the annual accumulator to the current year and lists available years", async () => {
    mockedIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2024-03-10T00:00:00.000Z",
    });

    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes" },
      now: NOW,
    });

    expect(report.selectedYear).toBe(2026);
    expect(report.availableYears).toEqual([2026, 2025, 2024]);
    expect(report.yearly).toMatchObject({ grossRevenue: expect.any(Number) });
  });

  it("maps the yearly accumulator from the SQL totals of the selected calendar year", async () => {
    mockedTotals.mockImplementation(async ({ from }) =>
      from === "2025-01-01"
        ? { ...EMPTY_TOTALS, revenue: 900, retailRevenue: 90, grossRevenue: 990, manualExpenses: 300, inventoryPurchases: 60, totalExpenses: 360, estimatedProfit: 630, completedCount: 12 }
        : { ...EMPTY_TOTALS, revenue: 100 }
    );
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "UTC", created_at: "2024-03-10T00:00:00.000Z" });

    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes" },
      year: 2025,
      now: NOW,
    });

    expect(mockedTotals).toHaveBeenCalledWith({
      from: "2025-01-01",
      to: "2025-12-31",
      timezone: "UTC",
      modules: { inventory: true, retail: true, expenses: true },
    });
    expect(report.yearly).toEqual({
      appointmentRevenue: 900,
      retailRevenue: 90,
      grossRevenue: 990,
      operationalExpenses: 300,
      inventoryPurchases: 60,
      totalExpenses: 360,
      estimatedProfit: 630,
      completedAppointments: 12,
    });
  });

  it("honors a requested past year within the available range", async () => {
    mockedIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2024-03-10T00:00:00.000Z",
    });

    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes" },
      year: 2025,
      now: NOW,
    });

    expect(report.selectedYear).toBe(2025);
  });

  it("falls back to the current year when the requested year has no data", async () => {
    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes" },
      year: 2020,
      now: NOW,
    });

    expect(report.selectedYear).toBe(2026);
  });

  it("passes disabled modules to the SQL totals so they read as zero", async () => {
    const modules = { inventory: false, retail: true, expenses: false };

    await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes", from: "2026-05-01", to: "2026-05-31" },
      modules,
      now: NOW,
    });

    expect(mockedTotals).toHaveBeenCalledWith(expect.objectContaining({ modules }));
  });

  it("pide la serie, horas, gastos, productos y alertas de la ventana de 12 meses en SQL", async () => {
    const modules = { inventory: true, retail: true, expenses: true };

    await getOperationalReport({ salonId: "salon-1", filters: { preset: "mes" }, now: NOW });

    expect(mockedSeries).toHaveBeenCalledWith({
      firstMonth: "2025-07",
      lastMonth: "2026-06",
      timezone: "UTC",
      modules,
    });
    expect(mockedBusyHours).toHaveBeenCalledWith({ from: "2025-07-01", to: "2026-06-30", timezone: "UTC" });
    expect(mockedExpenses).toHaveBeenCalledWith({
      from: "2025-07-01",
      to: "2026-06-30",
      modules,
      includeRestock: true,
      limit: 5,
    });
    expect(mockedProducts).toHaveBeenCalledWith({
      firstMonth: "2025-07",
      lastMonth: "2026-06",
      timezone: "UTC",
      modules,
      limit: 5,
    });
    expect(mockedAlerts).toHaveBeenCalledWith(modules);
  });

  it("arma el analisis historico con etiquetas de mes, horas y alertas de la base", async () => {
    mockedSeries.mockResolvedValue(
      zeroSeries().map((row) =>
        row.monthKey === "2026-05"
          ? { ...row, completedAppointments: 2, appointmentRevenue: 150, retailRevenue: 50, grossRevenue: 200, operationalExpenses: 150, totalExpenses: 150, profit: 50, marginPct: 25 }
          : row
      )
    );
    mockedBusyHours.mockResolvedValue([{ hour: 10, total: 2 }]);
    mockedAlerts.mockResolvedValue([
      { id: "p1", name: "Shampoo", retail: 1, internal: 0, storage: 0, total: 1, minimum: 2, state: "bajo" },
    ]);

    const report = await getOperationalReport({ salonId: "salon-1", filters: { preset: "mes" }, now: NOW });

    expect(report.analytics.months).toHaveLength(12);
    expect(report.analytics.months.at(-2)).toMatchObject({
      monthKey: "2026-05",
      completedAppointments: 2,
      totalRevenue: 200,
      totalExpenses: 150,
      profit: 50,
      marginPct: 25,
    });
    expect(report.analytics.months.at(-1)?.monthKey).toBe("2026-06");
    expect(report.analytics.months.every((point) => point.label.length > 0)).toBe(true);
    expect(report.analytics.busyHours).toEqual([expect.objectContaining({ hour: 10, total: 2 })]);
    expect(report.analytics.busyHours[0]?.label).toMatch(/10/);
    expect(report.analytics.inventoryAlerts).toEqual([
      { id: "p1", name: "Shampoo", retail: 1, internal: 0, storage: 0, total: 1, minimum: 2, state: "bajo" },
    ]);
  });

  it("falla con un mensaje claro si la serie mensual no cubre la ventana", async () => {
    mockedSeries.mockResolvedValue([]);

    await expect(getOperationalReport({ salonId: "salon-1", filters: { preset: "mes" }, now: NOW })).rejects.toThrow(
      "Invariante de reporte"
    );
  });
});
