import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCommissionReport,
  fetchOperationalBreakdown,
  fetchPeriodTotals,
} from "../data/rpc/reports-read-models.rpc";
import {
  findHistoricalReportRows,
  findSalonReportIdentity,
  findSalonTimezone,
} from "../data/reports.repo";
import { getOperationalReport } from "./get-operational-report";

vi.mock("../data/reports.repo", () => ({
  findHistoricalReportRows: vi.fn(),
  findSalonReportIdentity: vi.fn(),
  findSalonTimezone: vi.fn(),
}));

vi.mock("../data/rpc/reports-read-models.rpc", () => ({
  fetchPeriodTotals: vi.fn(),
  fetchOperationalBreakdown: vi.fn(),
  fetchCommissionReport: vi.fn(),
}));

const mockedTotals = vi.mocked(fetchPeriodTotals);
const mockedBreakdown = vi.mocked(fetchOperationalBreakdown);
const mockedCommissions = vi.mocked(fetchCommissionReport);
const mockedHistoricalRows = vi.mocked(findHistoricalReportRows);
const mockedTimezone = vi.mocked(findSalonTimezone);
const mockedIdentity = vi.mocked(findSalonReportIdentity);

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

describe("get operational report", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedTimezone.mockResolvedValue("UTC");
    mockedIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    mockedHistoricalRows.mockResolvedValue({
      appointmentMonths: [],
      busyHours: [],
      retailMonths: [],
      expenseGroups: [],
      purchaseMonths: [],
      productMonths: [],
      inventoryProducts: [],
    });
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
      now: new Date("2026-06-03T12:00:00.000Z"),
    });

    expect(report.selectedYear).toBe(2026);
    expect(report.availableYears).toEqual([2026, 2025, 2024]);
    expect(report.yearly).toMatchObject({ grossRevenue: expect.any(Number) });
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
      now: new Date("2026-06-03T12:00:00.000Z"),
    });

    expect(report.selectedYear).toBe(2025);
  });

  it("falls back to the current year when the requested year has no data", async () => {
    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes" },
      year: 2020,
      now: new Date("2026-06-03T12:00:00.000Z"),
    });

    expect(report.selectedYear).toBe(2026);
  });

  it("passes disabled modules to the SQL totals so they read as zero", async () => {
    const modules = { inventory: false, retail: true, expenses: false };

    await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes", from: "2026-05-01", to: "2026-05-31" },
      modules,
      now: new Date("2026-06-03T12:00:00.000Z"),
    });

    expect(mockedTotals).toHaveBeenCalledWith(expect.objectContaining({ modules }));
  });
});
