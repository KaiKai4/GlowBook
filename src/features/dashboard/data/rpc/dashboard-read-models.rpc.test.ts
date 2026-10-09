import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchDashboardMetrics,
  fetchMonthlyAppointmentSeries,
  fetchTopServices,
} from "./dashboard-read-models.rpc";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

const INPUT = { timezone: "America/Panama", now: new Date("2030-01-15T14:00:00.000Z") };

const VALID_METRICS = {
  todayAppointments: 3,
  appointmentRevenue: 35.5,
  retailRevenue: 12,
  manualExpenses: 5,
  inventoryPurchases: 7,
  lowStockProducts: 1,
  totalCustomers: 12,
  completedThisMonth: 2,
  monthRevenue: 47.5,
  monthExpenses: 12,
  estimatedProfit: 35.5,
};

describe("dashboard read-model rpc adapters", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("invoca report_dashboard_metrics con zona horaria y fecha de referencia y valida el resultado", async () => {
    rpc.mockResolvedValue({ data: VALID_METRICS, error: null });

    const metrics = await fetchDashboardMetrics(INPUT);

    expect(rpc).toHaveBeenCalledWith("report_dashboard_metrics", {
      p_timezone: "America/Panama",
      p_now: "2030-01-15T14:00:00.000Z",
    });
    expect(metrics).toMatchObject({ appointmentRevenue: 35.5, lowStockProducts: 1, completedThisMonth: 2 });
  });

  it("rechaza un resultado de metricas con campos que no son numeros", async () => {
    rpc.mockResolvedValue({ data: { ...VALID_METRICS, totalCustomers: "12" }, error: null });

    await expect(fetchDashboardMetrics(INPUT)).rejects.toThrow();
  });

  it("propaga el error de la RPC de metricas", async () => {
    const dbError = new Error("permission denied");
    rpc.mockResolvedValue({ data: null, error: dbError });

    await expect(fetchDashboardMetrics(INPUT)).rejects.toBe(dbError);
  });

  it("valida la serie mensual y rechaza tendencias fuera del contrato", async () => {
    rpc.mockResolvedValue({
      data: [{ monthKey: "2030-01", total: 2, delta: 1, trend: "up" }],
      error: null,
    });
    await expect(fetchMonthlyAppointmentSeries(INPUT)).resolves.toEqual([
      { monthKey: "2030-01", total: 2, delta: 1, trend: "up" },
    ]);
    expect(rpc).toHaveBeenCalledWith("report_dashboard_monthly_appointments", {
      p_timezone: "America/Panama",
      p_now: "2030-01-15T14:00:00.000Z",
    });

    rpc.mockResolvedValue({
      data: [{ monthKey: "2030-01", total: 2, delta: 1, trend: "sideways" }],
      error: null,
    });
    await expect(fetchMonthlyAppointmentSeries(INPUT)).rejects.toThrow();
  });

  it("valida los servicios principales y acepta lista vacia", async () => {
    rpc.mockResolvedValue({ data: [{ name: "Corte", count: 2, pct: 100 }], error: null });
    await expect(fetchTopServices(INPUT)).resolves.toEqual([{ name: "Corte", count: 2, pct: 100 }]);
    expect(rpc).toHaveBeenCalledWith("report_dashboard_top_services", {
      p_timezone: "America/Panama",
      p_now: "2030-01-15T14:00:00.000Z",
    });

    rpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchTopServices(INPUT)).resolves.toEqual([]);
  });
});
