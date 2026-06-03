import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonIdentity } from "@/features/salon/data/salon.repo";
import { sumExpensesTotal } from "@/features/expenses/data/expenses.repo";
import { getInventoryPage } from "@/features/inventory/use-cases/inventory-products";
import { sumInventoryPurchasesTotal } from "@/features/inventory/data/inventory.repo";
import { sumRetailSalesTotal } from "@/features/retail/data/retail.repo";
import {
  findDashboardReportRows,
  findPendingConfirmationRows,
} from "../data/dashboard.repo";
import { getDashboardOverview } from "./get-dashboard-overview";

vi.mock("@/features/salon/data/salon.repo", () => ({
  findSalonIdentity: vi.fn(),
}));
vi.mock("@/features/expenses/data/expenses.repo", () => ({
  sumExpensesTotal: vi.fn(),
}));
vi.mock("@/features/inventory/data/inventory.repo", () => ({
  sumInventoryPurchasesTotal: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/inventory-products", () => ({
  getInventoryPage: vi.fn(),
}));
vi.mock("@/features/retail/data/retail.repo", () => ({
  sumRetailSalesTotal: vi.fn(),
}));

vi.mock("../data/dashboard.repo", () => ({
  findDashboardReportRows: vi.fn(),
  findPendingConfirmationRows: vi.fn(),
}));

const mockedFindSalonIdentity = vi.mocked(findSalonIdentity);
const mockedSumExpensesTotal = vi.mocked(sumExpensesTotal);
const mockedGetInventoryPage = vi.mocked(getInventoryPage);
const mockedSumInventoryPurchasesTotal = vi.mocked(sumInventoryPurchasesTotal);
const mockedSumRetailSalesTotal = vi.mocked(sumRetailSalesTotal);
const mockedFindDashboardReportRows = vi.mocked(findDashboardReportRows);
const mockedFindPendingConfirmationRows = vi.mocked(findPendingConfirmationRows);

describe("get dashboard overview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindSalonIdentity.mockResolvedValue({
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
    mockedSumExpensesTotal.mockResolvedValue(0);
    mockedSumInventoryPurchasesTotal.mockResolvedValue(0);
    mockedSumRetailSalesTotal.mockResolvedValue(0);
    mockedGetInventoryPage.mockResolvedValue({
      products: [],
      lowStock: [],
      recentMovements: [],
    });
  });

  it("returns an empty overview without touching data adapters when all sections are disabled", async () => {
    const view = await getDashboardOverview({
      salonId: "salon-1",
      wantsReports: false,
      wantsConfirmations: false,
    });

    expect(view).toEqual({ metrics: null, topServices: [], pending: [] });
    expect(mockedFindSalonIdentity).not.toHaveBeenCalled();
    expect(mockedFindDashboardReportRows).not.toHaveBeenCalled();
    expect(mockedFindPendingConfirmationRows).not.toHaveBeenCalled();
  });

  it("maps report metrics, ignores cancelled booked services and keeps top-service percentages relative", async () => {
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
      retailRevenue: 0,
      monthRevenue: 35.5,
      monthExpenses: 0,
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
