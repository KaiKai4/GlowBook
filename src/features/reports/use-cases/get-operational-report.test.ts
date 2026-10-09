import { beforeEach, describe, expect, it, vi } from "vitest";
import { getExternalOperationalMoney } from "@/features/finance/use-cases/operational-money";
import {
  findHistoricalReportRows,
  findOperationalReportRows,
  findSalonReportIdentity,
  findSalonTimezone,
} from "../data/reports.repo";
import { getOperationalReport } from "./get-operational-report";

vi.mock("@/features/finance/use-cases/operational-money", () => ({
  getExternalOperationalMoney: vi.fn(),
}));

vi.mock("../data/reports.repo", () => ({
  findHistoricalReportRows: vi.fn(),
  findOperationalReportRows: vi.fn(),
  findSalonReportIdentity: vi.fn(),
  findSalonTimezone: vi.fn(),
}));

const mockedExternalMoney = vi.mocked(getExternalOperationalMoney);
const mockedRows = vi.mocked(findOperationalReportRows);
const mockedHistoricalRows = vi.mocked(findHistoricalReportRows);
const mockedTimezone = vi.mocked(findSalonTimezone);
const mockedIdentity = vi.mocked(findSalonReportIdentity);

describe("get operational report", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedTimezone.mockResolvedValue("UTC");
    mockedIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    mockedExternalMoney.mockResolvedValue({
      retailRevenue: 25,
      manualExpenses: 10,
      inventoryPurchases: 15,
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
    mockedRows.mockResolvedValue({
      appointments: [
        { id: "appointment-1", status: "completed", totalPrice: 100, discountAmount: 5 },
        { id: "appointment-2", status: "scheduled", totalPrice: 30, discountAmount: 0 },
      ],
      items: [
        {
          appointmentId: "appointment-1",
          price: 100,
          serviceId: "service-1",
          serviceName: "Manicura",
          employeeId: "employee-1",
          employeeName: "Ana Mora",
          employeeCommissionPct: 0,
        },
      ],
      newCustomers: 2,
    });
  });

  it("combines appointment metrics with the operational money read model", async () => {
    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: {
        preset: "mes",
        from: "2026-06-01",
        to: "2026-06-03",
      },
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
    expect(mockedExternalMoney).toHaveBeenCalledWith({
      salonId: "salon-1",
      fromIso: expect.any(String),
      toIso: expect.any(String),
      fromDate: "2026-06-01",
      toDate: "2026-06-03",
    });
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
    mockedIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2026-01-01T00:00:00.000Z",
    });

    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes" },
      year: 2020,
      now: new Date("2026-06-03T12:00:00.000Z"),
    });

    expect(report.selectedYear).toBe(2026);
  });

  it("loads the selected period metrics for the filter", async () => {
    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: {
        preset: "mes",
        from: "2026-05-01",
        to: "2026-05-31",
      },
      modules: {
        inventory: false,
        retail: true,
        expenses: false,
      },
      now: new Date("2026-06-03T12:00:00.000Z"),
    });

    expect(report.retailRevenue).toBe(25);
    expect(report.manualExpenses).toBe(0);
    expect(report.inventoryPurchases).toBe(0);
    expect(report.totalExpenses).toBe(0);
  });
});
