import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { getExternalOperationalMoney } from "@/features/finance/use-cases/operational-money";
import { getLowStockSummary } from "@/features/inventory/use-cases/low-stock-summary";
import {
  findDashboardReportRows,
  findPendingConfirmationRows,
} from "../data/dashboard.repo";
import { getDashboardOverview } from "./get-dashboard-overview";

vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));
vi.mock("@/features/finance/use-cases/operational-money", () => ({
  getExternalOperationalMoney: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/low-stock-summary", () => ({
  getLowStockSummary: vi.fn(),
}));

vi.mock("../data/dashboard.repo", () => ({
  findDashboardReportRows: vi.fn(),
  findPendingConfirmationRows: vi.fn(),
}));

const mockedGetSalonIdentity = vi.mocked(getSalonIdentity);
const mockedExternalMoney = vi.mocked(getExternalOperationalMoney);
const mockedGetLowStockSummary = vi.mocked(getLowStockSummary);
const mockedFindDashboardReportRows = vi.mocked(findDashboardReportRows);
const mockedFindPendingConfirmationRows = vi.mocked(findPendingConfirmationRows);

describe("get dashboard overview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetSalonIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
    });
    mockedFindDashboardReportRows.mockResolvedValue({
      todayAppointments: 0,
      monthAppointments: [],
      totalCustomers: 0,
      bookedServices: [],
    });
    mockedFindPendingConfirmationRows.mockResolvedValue([]);
    mockedExternalMoney.mockResolvedValue({
      retailRevenue: 0,
      manualExpenses: 0,
      inventoryPurchases: 0,
    });
    mockedGetLowStockSummary.mockResolvedValue({ productCount: 0 });
  });

  it("returns an empty overview without touching data adapters when all sections are disabled", async () => {
    const view = await getDashboardOverview({
      salonId: "salon-1",
      wantsReports: false,
      wantsConfirmations: false,
    });

    expect(view).toEqual({ metrics: null, topServices: [], pending: [] });
    expect(mockedGetSalonIdentity).not.toHaveBeenCalled();
    expect(mockedFindDashboardReportRows).not.toHaveBeenCalled();
    expect(mockedFindPendingConfirmationRows).not.toHaveBeenCalled();
  });

  it("maps report metrics, ignores cancelled booked services and keeps top-service percentages relative", async () => {
    mockedExternalMoney.mockResolvedValue({
      retailRevenue: 12,
      manualExpenses: 5,
      inventoryPurchases: 7,
    });
    mockedFindDashboardReportRows.mockResolvedValue({
      todayAppointments: 3,
      monthAppointments: [
        { total_price: 10, status: "completed" },
        { total_price: 25.5, status: "completed" },
      ],
      totalCustomers: 12,
      bookedServices: [
        { service: { name: "Corte" }, appointment: { status: "completed" } },
        { service: { name: "Corte" }, appointment: { status: "scheduled" } },
        { service: { name: "Color" }, appointment: { status: "completed" } },
        { service: { name: "Color" }, appointment: { status: "cancelled" } },
        { service: null, appointment: { status: "completed" } },
      ],
    });

    const view = await getDashboardOverview({
      salonId: "salon-1",
      wantsReports: true,
      wantsConfirmations: false,
      now: new Date("2030-01-15T14:00:00.000Z"),
    });

    expect(view.metrics).toEqual({
      todayAppointments: 3,
      appointmentRevenue: 35.5,
      retailRevenue: 12,
      monthRevenue: 47.5,
      monthExpenses: 12,
      estimatedProfit: 35.5,
      lowStockProducts: 0,
      totalCustomers: 12,
      completedThisMonth: 2,
    });
    expect(view.topServices).toEqual([
      { name: "Corte", count: 2, pct: 100 },
      { name: "Color", count: 1, pct: 50 },
    ]);
    expect(mockedFindPendingConfirmationRows).not.toHaveBeenCalled();
  });

  it("maps pending confirmations without loading reports when only confirmations are requested", async () => {
    mockedFindPendingConfirmationRows.mockResolvedValue([
      {
        id: "appointment-1",
        start_time: "2030-01-15T14:00:00.000Z",
        customer: {
          first_name: "Ana",
          last_name: "Vega",
          phone: "60000000",
        },
      },
      {
        id: "appointment-2",
        start_time: null,
        customer: null,
      },
    ]);

    const view = await getDashboardOverview({
      salonId: "salon-1",
      wantsReports: false,
      wantsConfirmations: true,
      now: new Date("2030-01-15T13:00:00.000Z"),
    });

    expect(view.metrics).toBeNull();
    expect(view.topServices).toEqual([]);
    expect(view.pending).toEqual([
      {
        id: "appointment-1",
        customerName: "Ana Vega",
        phone: "60000000",
        when: expect.any(String),
      },
      {
        id: "appointment-2",
        customerName: "Cliente",
        phone: null,
        when: "",
      },
    ]);
    expect(mockedFindDashboardReportRows).not.toHaveBeenCalled();
  });
});
