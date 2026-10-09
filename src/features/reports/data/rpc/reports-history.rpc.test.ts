import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBusyHours,
  fetchExpenseConcepts,
  fetchInventoryAlerts,
  fetchMonthlySeries,
  fetchProductSales,
} from "./reports-history.rpc";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

const MODULES = { inventory: true, retail: false, expenses: true };
const MODULES_ARG = { inventory: true, retail: false, expenses: true };

const SERIES_ROW = {
  monthKey: "2026-05",
  completedAppointments: 2,
  appointmentRevenue: 150,
  retailRevenue: 50,
  grossRevenue: 200,
  operationalExpenses: 150,
  inventoryPurchases: 0,
  totalExpenses: 150,
  profit: 50,
  marginPct: 25,
};

describe("reports history rpc adapters", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  describe("fetchMonthlySeries", () => {
    it("invoca report_monthly_series con el rango de meses, zona y modulos", async () => {
      rpc.mockResolvedValue({ data: [SERIES_ROW], error: null });

      const series = await fetchMonthlySeries({
        firstMonth: "2026-05",
        lastMonth: "2026-06",
        timezone: "America/Panama",
        modules: MODULES,
      });

      expect(rpc).toHaveBeenCalledWith("report_monthly_series", {
        p_first_month: "2026-05",
        p_last_month: "2026-06",
        p_timezone: "America/Panama",
        p_modules: MODULES_ARG,
      });
      expect(series).toEqual([SERIES_ROW]);
    });

    it("rechaza una respuesta con forma inesperada", async () => {
      rpc.mockResolvedValue({ data: [{ monthKey: "2026-05" }], error: null });

      await expect(
        fetchMonthlySeries({ firstMonth: "2026-05", lastMonth: "2026-05", timezone: "UTC", modules: MODULES })
      ).rejects.toThrow();
    });

    it("propaga el error de la base", async () => {
      const dbError = { message: "fallo" };
      rpc.mockResolvedValue({ data: null, error: dbError });

      await expect(
        fetchMonthlySeries({ firstMonth: "2026-05", lastMonth: "2026-05", timezone: "UTC", modules: MODULES })
      ).rejects.toBe(dbError);
    });
  });

  describe("fetchBusyHours", () => {
    it("invoca report_busy_hours con dias locales y zona", async () => {
      rpc.mockResolvedValue({ data: [{ hour: 10, total: 2 }], error: null });

      const busy = await fetchBusyHours({ from: "2026-05-01", to: "2026-05-31", timezone: "America/Panama" });

      expect(rpc).toHaveBeenCalledWith("report_busy_hours", {
        p_from: "2026-05-01",
        p_to: "2026-05-31",
        p_timezone: "America/Panama",
      });
      expect(busy).toEqual([{ hour: 10, total: 2 }]);
    });
  });

  describe("fetchExpenseConcepts", () => {
    it("pasa el top N y la reposicion de inventario cuando se piden", async () => {
      rpc.mockResolvedValue({ data: [{ label: "Alquiler", amount: 150 }], error: null });

      const concepts = await fetchExpenseConcepts({
        from: "2026-05-01",
        to: "2026-05-31",
        modules: MODULES,
        includeRestock: true,
        limit: 5,
      });

      expect(rpc).toHaveBeenCalledWith("report_expense_concepts", {
        p_from: "2026-05-01",
        p_to: "2026-05-31",
        p_modules: MODULES_ARG,
        p_include_restock: true,
        p_limit: 5,
      });
      expect(concepts).toEqual([{ label: "Alquiler", amount: 150 }]);
    });

    it("sin limite no envia p_limit para que la base devuelva todos los conceptos", async () => {
      rpc.mockResolvedValue({ data: [], error: null });

      await fetchExpenseConcepts({ from: "2026-05-01", to: "2026-05-31", modules: MODULES, includeRestock: false });

      expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_limit");
      expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_include_restock: false });
    });
  });

  describe("fetchProductSales", () => {
    it("invoca report_product_sales con el rango de meses, modulos y limite", async () => {
      const product = { id: "p1", name: "Tinte", total: 5, months: [0, 3, 2] };
      rpc.mockResolvedValue({ data: [product], error: null });

      const sales = await fetchProductSales({
        firstMonth: "2026-04",
        lastMonth: "2026-06",
        timezone: "America/Panama",
        modules: MODULES,
        limit: 5,
      });

      expect(rpc).toHaveBeenCalledWith("report_product_sales", {
        p_first_month: "2026-04",
        p_last_month: "2026-06",
        p_timezone: "America/Panama",
        p_modules: MODULES_ARG,
        p_limit: 5,
      });
      expect(sales).toEqual([product]);
    });
  });

  describe("fetchInventoryAlerts", () => {
    it("invoca report_inventory_alerts con los modulos y valida el estado", async () => {
      const alert = {
        id: "p1",
        name: "Shampoo",
        retail: 1,
        internal: 0,
        storage: 0,
        total: 1,
        minimum: 2,
        state: "bajo",
      };
      rpc.mockResolvedValue({ data: [alert], error: null });

      const alerts = await fetchInventoryAlerts(MODULES);

      expect(rpc).toHaveBeenCalledWith("report_inventory_alerts", { p_modules: MODULES_ARG });
      expect(alerts).toEqual([alert]);
    });

    it("rechaza un estado fuera del catalogo de alertas", async () => {
      rpc.mockResolvedValue({
        data: [{ id: "p1", name: "X", retail: 0, internal: 0, storage: 0, total: 0, minimum: 0, state: "ok" }],
        error: null,
      });

      await expect(fetchInventoryAlerts(MODULES)).rejects.toThrow();
    });
  });
});
