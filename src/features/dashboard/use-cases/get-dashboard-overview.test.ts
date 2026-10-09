import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { findPendingConfirmationRows } from "../data/dashboard.repo";
import {
  fetchDashboardMetrics,
  fetchMonthlyAppointmentSeries,
  fetchTopServices,
  type MonthlyAppointmentSeriesRow,
} from "../data/rpc/dashboard-read-models.rpc";
import { getDashboardOverview } from "./get-dashboard-overview";

vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));
vi.mock("../data/dashboard.repo", () => ({
  findPendingConfirmationRows: vi.fn(),
}));
vi.mock("../data/rpc/dashboard-read-models.rpc", () => ({
  fetchDashboardMetrics: vi.fn(),
  fetchMonthlyAppointmentSeries: vi.fn(),
  fetchTopServices: vi.fn(),
}));

const mockedGetSalonIdentity = vi.mocked(getSalonIdentity);
const mockedFindPendingConfirmationRows = vi.mocked(findPendingConfirmationRows);
const mockedFetchMetrics = vi.mocked(fetchDashboardMetrics);
const mockedFetchSeries = vi.mocked(fetchMonthlyAppointmentSeries);
const mockedFetchTopServices = vi.mocked(fetchTopServices);

// Serie de 12 meses (orden cronologico) con la misma definicion que report_dashboard_monthly_appointments.
function monthlySeries(firstYear: number, firstMonth: number, totals: number[]): MonthlyAppointmentSeriesRow[] {
  return totals.map((total, index) => {
    const absolute = firstYear * 12 + (firstMonth - 1) + index;
    const monthKey = `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, "0")}`;
    const previous = index > 0 ? (totals[index - 1] ?? total) : total;
    const delta = total - previous;
    const trend: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { monthKey, total, delta, trend };
  });
}

describe("get dashboard overview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetSalonIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      payment_methods: ["cash", "card"],
    });
    mockedFetchMetrics.mockResolvedValue({
      todayAppointments: 0,
      appointmentRevenue: 0,
      retailRevenue: 0,
      manualExpenses: 0,
      inventoryPurchases: 0,
      lowStockProducts: 0,
      totalCustomers: 0,
      completedThisMonth: 0,
    });
    mockedFetchSeries.mockResolvedValue(monthlySeries(2019, 2, new Array<number>(12).fill(0)));
    mockedFetchTopServices.mockResolvedValue([]);
    mockedFindPendingConfirmationRows.mockResolvedValue([]);
  });

  it("returns an empty overview without touching data adapters when all sections are disabled", async () => {
    const view = await getDashboardOverview({
      salonId: "salon-1",
      wantsReports: false,
      wantsConfirmations: false,
    });

    expect(view).toEqual({ metrics: null, topServices: [], monthlyCompletedAppointments: [], pending: [] });
    expect(mockedGetSalonIdentity).not.toHaveBeenCalled();
    expect(mockedFetchMetrics).not.toHaveBeenCalled();
    expect(mockedFindPendingConfirmationRows).not.toHaveBeenCalled();
  });

  it("maps aggregated report metrics, top services and the monthly series with the previous view model", async () => {
    mockedFetchMetrics.mockResolvedValue({
      todayAppointments: 3,
      appointmentRevenue: 35.5,
      retailRevenue: 12,
      manualExpenses: 5,
      inventoryPurchases: 7,
      lowStockProducts: 0,
      totalCustomers: 12,
      completedThisMonth: 2,
    });
    mockedFetchTopServices.mockResolvedValue([
      { name: "Corte", count: 2, pct: 100 },
      { name: "Color", count: 1, pct: 50 },
    ]);
    mockedFetchSeries.mockResolvedValue(monthlySeries(2029, 2, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2]));

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
    expect(view.monthlyCompletedAppointments).toHaveLength(12);
    expect(view.monthlyCompletedAppointments.at(-2)).toMatchObject({ monthKey: "2029-12", total: 1, trend: "up" });
    expect(view.monthlyCompletedAppointments.at(-1)).toMatchObject({
      monthKey: "2030-01",
      total: 2,
      delta: 1,
      trend: "up",
    });
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
    expect(view.monthlyCompletedAppointments).toEqual([]);
    expect(view.pending).toEqual([
      { id: "appointment-1", customerName: "Ana Vega", phone: "60000000", when: expect.any(String) },
      { id: "appointment-2", customerName: "Cliente", phone: null, when: "" },
    ]);
    expect(mockedFetchMetrics).not.toHaveBeenCalled();
  });
});
