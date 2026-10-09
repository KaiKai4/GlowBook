import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCommissionReport,
  fetchOperationalBreakdown,
  fetchPeriodTotals,
} from "./reports-read-models.rpc";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

const RANGE = { from: "2026-06-01", to: "2026-06-30", timezone: "America/Panama" };
const MODULES = { inventory: true, retail: false, expenses: true };

const VALID_TOTALS = {
  revenue: 175,
  discounts: 5,
  retailRevenue: 25,
  grossRevenue: 200,
  manualExpenses: 10,
  inventoryPurchases: 15,
  totalExpenses: 25,
  estimatedProfit: 175,
  completedCount: 2,
  totalCount: 4,
  avgTicket: 87.5,
  noShowRate: 25,
  newCustomers: 2,
  from: "2026-06-01",
  to: "2026-06-30",
};

describe("reports read-model rpc adapters", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  describe("fetchPeriodTotals", () => {
    it("invoca report_period_totals con dias locales, zona y modulos", async () => {
      rpc.mockResolvedValue({ data: VALID_TOTALS, error: null });

      const totals = await fetchPeriodTotals({ ...RANGE, modules: MODULES });

      expect(rpc).toHaveBeenCalledWith("report_period_totals", {
        p_from: "2026-06-01",
        p_to: "2026-06-30",
        p_timezone: "America/Panama",
        p_modules: { inventory: true, retail: false, expenses: true },
      });
      expect(totals).toEqual({
        revenue: 175,
        discounts: 5,
        retailRevenue: 25,
        grossRevenue: 200,
        manualExpenses: 10,
        inventoryPurchases: 15,
        totalExpenses: 25,
        estimatedProfit: 175,
        completedCount: 2,
        totalCount: 4,
        avgTicket: 87.5,
        noShowRate: 25,
        newCustomers: 2,
      });
    });

    it("rechaza un resultado con cifras que no son numeros", async () => {
      rpc.mockResolvedValue({ data: { ...VALID_TOTALS, revenue: "175" }, error: null });

      await expect(fetchPeriodTotals({ ...RANGE, modules: MODULES })).rejects.toThrow();
    });

    it("propaga el error de la RPC", async () => {
      const dbError = { message: "fallo" };
      rpc.mockResolvedValue({ data: null, error: dbError });

      await expect(fetchPeriodTotals({ ...RANGE, modules: MODULES })).rejects.toBe(dbError);
    });
  });

  describe("fetchOperationalBreakdown", () => {
    it("valida estados, empleados y servicios del desglose", async () => {
      rpc.mockResolvedValue({
        data: {
          statusBreakdown: [{ status: "completed", count: 2, pct: 50 }],
          byEmployee: [{ id: "e1", name: "Ana Mora", count: 2, revenue: 155, pct: 100 }],
          byService: [{ id: "s1", name: "Manicura", count: 2, revenue: 155, pct: 100 }],
        },
        error: null,
      });

      const breakdown = await fetchOperationalBreakdown(RANGE);

      expect(rpc).toHaveBeenCalledWith("report_operational_breakdown", {
        p_from: "2026-06-01",
        p_to: "2026-06-30",
        p_timezone: "America/Panama",
      });
      expect(breakdown.byEmployee).toEqual([{ name: "Ana Mora", count: 2, revenue: 155, pct: 100 }]);
      expect(breakdown.statusBreakdown).toEqual([{ status: "completed", count: 2, pct: 50 }]);
    });

    it("rechaza un desglose sin la lista de servicios", async () => {
      rpc.mockResolvedValue({ data: { statusBreakdown: [], byEmployee: [] }, error: null });

      await expect(fetchOperationalBreakdown(RANGE)).rejects.toThrow();
    });
  });

  describe("fetchCommissionReport", () => {
    it("invoca report_commissions y devuelve filas y totales validados", async () => {
      rpc.mockResolvedValue({
        data: {
          rows: [
            {
              employeeId: "e1",
              name: "Ana Mora",
              appointments: 2,
              revenue: 155,
              commissionPct: 20,
              commission: 31,
            },
          ],
          totalRevenue: 155,
          totalCommission: 31,
        },
        error: null,
      });

      const report = await fetchCommissionReport(RANGE);

      expect(rpc).toHaveBeenCalledWith("report_commissions", {
        p_from: "2026-06-01",
        p_to: "2026-06-30",
        p_timezone: "America/Panama",
      });
      expect(report).toEqual({
        rows: [
          { employeeId: "e1", name: "Ana Mora", appointments: 2, revenue: 155, commissionPct: 20, commission: 31 },
        ],
        totalRevenue: 155,
        totalCommission: 31,
      });
    });
  });
});
