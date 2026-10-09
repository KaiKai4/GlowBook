import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonReportIdentity } from "../data/reports.repo";
import { fetchPeriodTotals } from "../data/rpc/reports-read-models.rpc";
import {
  fetchExpenseConcepts,
  fetchMonthlySeries,
  fetchProductSales,
  type MonthlySeriesRow,
} from "../data/rpc/reports-history.rpc";
import type { ReportModuleAvailability } from "../domain/analytics";
import { getReportExportData } from "./get-report-export";

vi.mock("../data/reports.repo", () => ({
  findSalonReportIdentity: vi.fn(),
}));

vi.mock("../data/rpc/reports-read-models.rpc", () => ({
  fetchPeriodTotals: vi.fn(),
}));

vi.mock("../data/rpc/reports-history.rpc", () => ({
  fetchMonthlySeries: vi.fn(),
  fetchExpenseConcepts: vi.fn(),
  fetchProductSales: vi.fn(),
}));

const mockedIdentity = vi.mocked(findSalonReportIdentity);
const mockedSeries = vi.mocked(fetchMonthlySeries);
const mockedTotals = vi.mocked(fetchPeriodTotals);
const mockedExpenses = vi.mocked(fetchExpenseConcepts);
const mockedProducts = vi.mocked(fetchProductSales);

const ALL_MODULES: ReportModuleAvailability = { inventory: true, retail: true, expenses: true };
const NOW = new Date("2026-06-10T15:00:00.000Z");

function monthRow(monthKey: string, overrides: Partial<MonthlySeriesRow> = {}): MonthlySeriesRow {
  return {
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
    ...overrides,
  };
}

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

describe("getReportExportData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "America/Panama", created_at: "2025-01-01T00:00:00.000Z" });
    mockedSeries.mockResolvedValue([]);
    mockedTotals.mockResolvedValue(EMPTY_TOTALS);
    mockedExpenses.mockResolvedValue([]);
    mockedProducts.mockResolvedValue([]);
  });

  it("usa el nombre y la zona horaria por defecto cuando el salon no tiene identidad", async () => {
    mockedIdentity.mockResolvedValue(null);

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(data).toMatchObject({ salonName: "GlowBook", timezone: "America/Panama" });
    expect(mockedSeries).toHaveBeenCalledWith(expect.objectContaining({ timezone: "America/Panama" }));
  });

  it("exporta el historico completo con la ventana amplia de SQL y recorta los meses vacios", async () => {
    mockedSeries.mockResolvedValue([
      monthRow("2026-03"),
      monthRow("2026-04", { completedAppointments: 3, appointmentRevenue: 300, grossRevenue: 300, profit: 300 }),
      monthRow("2026-05", { completedAppointments: 1, appointmentRevenue: 100, grossRevenue: 100, profit: 100 }),
      monthRow("2026-06"),
      monthRow("2026-07"),
    ]);
    mockedTotals.mockResolvedValue({
      ...EMPTY_TOTALS,
      revenue: 400,
      grossRevenue: 400,
      estimatedProfit: 400,
      completedCount: 4,
    });

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(mockedSeries).toHaveBeenCalledWith({
      firstMonth: "1970-01",
      lastMonth: "2027-12",
      timezone: "America/Panama",
      modules: ALL_MODULES,
    });
    expect(mockedTotals).toHaveBeenCalledWith({
      from: "1970-01-01",
      to: "2027-12-31",
      timezone: "America/Panama",
      modules: ALL_MODULES,
    });
    expect(data.scopeLabel).toBe("histórico completo");
    expect(data.totalsSuffix).toBe("(histórico)");
    expect(data.months.map((row) => row.monthKey)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(data.months[2]).toMatchObject({ monthKey: "2026-06", completedAppointments: 0, profit: 0 });
    expect(data.months[0]).not.toHaveProperty("marginPct");
    expect(data.totals).toMatchObject({ appointmentRevenue: 400, completedAppointments: 4, estimatedProfit: 400 });
    expect(data.generatedAtLabel.length).toBeGreaterThan(0);
  });

  it("exporta un mes puntual y devuelve una fila en cero si no hubo movimientos", async () => {
    mockedSeries.mockResolvedValue([monthRow("2026-05")]);

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "month", monthKey: "2026-05" }, NOW);

    expect(mockedSeries).toHaveBeenCalledWith(
      expect.objectContaining({ firstMonth: "2026-05", lastMonth: "2026-05" })
    );
    expect(mockedTotals).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-05-01", to: "2026-05-31", timezone: "America/Panama" })
    );
    expect(data.months).toHaveLength(1);
    expect(data.months[0]).toMatchObject({
      monthKey: "2026-05",
      completedAppointments: 0,
      grossRevenue: 0,
      totalExpenses: 0,
      profit: 0,
    });
    expect(data.months[0]?.label).toContain("2026");
    expect(data.scopeLabel).toContain("2026");
    expect(data.totalsSuffix).toBe(`(${data.scopeLabel})`);
  });

  it("exporta un año calendario con su etiqueta y rellena hasta diciembre desde el primer movimiento", async () => {
    const months = Array.from({ length: 12 }, (_, index) =>
      monthRow(`2025-${String(index + 1).padStart(2, "0")}`, index === 2 ? { completedAppointments: 1, appointmentRevenue: 50, grossRevenue: 50, profit: 50 } : {})
    );
    mockedSeries.mockResolvedValue(months);

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "year", year: 2025 }, NOW);

    expect(mockedSeries).toHaveBeenCalledWith(
      expect.objectContaining({ firstMonth: "2025-01", lastMonth: "2025-12" })
    );
    expect(mockedTotals).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2025-01-01", to: "2025-12-31" })
    );
    expect(data.scopeLabel).toBe("año 2025");
    expect(data.totalsSuffix).toBe("(año 2025)");
    expect(data.months.at(-1)?.monthKey).toBe("2025-12");
    expect(data.months[0]?.monthKey).toBe("2025-03");
    expect(data.months).toHaveLength(10);
  });

  it("ordena los conceptos de gasto de mayor a menor desde SQL, sin reposiciones", async () => {
    mockedExpenses.mockResolvedValue([
      { label: "Alquiler", amount: 400 },
      { label: "Luz", amount: 80 },
    ]);

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(mockedExpenses).toHaveBeenCalledWith({
      from: "1970-01-01",
      to: "2027-12-31",
      modules: ALL_MODULES,
      includeRestock: false,
    });
    expect(data.expenseConcepts).toEqual([
      { label: "Alquiler", amount: 400 },
      { label: "Luz", amount: 80 },
    ]);
  });

  it("entrega las ventas de productos por nombre y cantidad desde SQL", async () => {
    mockedProducts.mockResolvedValue([
      { id: "p2", name: "Shampoo", total: 9, months: [] },
      { id: "p1", name: "Tinte", total: 5, months: [] },
    ]);

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(mockedProducts).toHaveBeenCalledWith(
      expect.objectContaining({ firstMonth: "1970-01", lastMonth: "2027-12", timezone: "America/Panama", modules: ALL_MODULES })
    );
    expect(data.productTotals).toEqual([
      { name: "Shampoo", quantity: 9 },
      { name: "Tinte", quantity: 5 },
    ]);
  });

  it("pide a SQL sin gastos ni productos cuando esos modulos estan desactivados", async () => {
    const modules = { inventory: false, retail: false, expenses: false };
    mockedExpenses.mockResolvedValue([]);
    mockedProducts.mockResolvedValue([]);

    const data = await getReportExportData("salon-1", modules, { type: "lifetime" }, NOW);

    expect(mockedExpenses).toHaveBeenCalledWith(expect.objectContaining({ modules }));
    expect(mockedProducts).toHaveBeenCalledWith(expect.objectContaining({ modules }));
    expect(data.expenseConcepts).toEqual([]);
    expect(data.productTotals).toEqual([]);
    expect(data.modules).toEqual({ inventory: false, retail: false, expenses: false });
  });
});
