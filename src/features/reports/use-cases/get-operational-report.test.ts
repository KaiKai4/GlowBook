import { beforeEach, describe, expect, it, vi } from "vitest";
import { getExternalOperationalMoney } from "@/features/finance/use-cases/operational-money";
import { findOperationalReportRows, findSalonTimezone } from "../data/reports.repo";
import { getOperationalReport } from "./get-operational-report";

vi.mock("@/features/finance/use-cases/operational-money", () => ({
  getExternalOperationalMoney: vi.fn(),
}));

vi.mock("../data/reports.repo", () => ({
  findOperationalReportRows: vi.fn(),
  findSalonTimezone: vi.fn(),
}));

const mockedExternalMoney = vi.mocked(getExternalOperationalMoney);
const mockedRows = vi.mocked(findOperationalReportRows);
const mockedTimezone = vi.mocked(findSalonTimezone);

describe("get operational report", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedTimezone.mockResolvedValue("UTC");
    mockedExternalMoney.mockResolvedValue({
      retailRevenue: 25,
      manualExpenses: 10,
      inventoryPurchases: 15,
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
});
