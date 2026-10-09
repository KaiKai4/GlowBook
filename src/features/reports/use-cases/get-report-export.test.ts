import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findHistoricalReportRows,
  findSalonReportIdentity,
  type HistoricalReportRows,
} from "../data/reports.repo";
import type { ReportModuleAvailability } from "../domain/analytics";
import { LIFETIME_RANGE } from "./get-operational-report";
import { getReportExportData } from "./get-report-export";

vi.mock("../data/reports.repo", () => ({
  findHistoricalReportRows: vi.fn(),
  findSalonReportIdentity: vi.fn(),
}));

const mockedIdentity = vi.mocked(findSalonReportIdentity);
const mockedHistorical = vi.mocked(findHistoricalReportRows);

const ALL_MODULES: ReportModuleAvailability = { inventory: true, retail: true, expenses: true };
const NOW = new Date("2026-06-10T15:00:00.000Z");

function historicalRows(overrides: Partial<HistoricalReportRows> = {}): HistoricalReportRows {
  return {
    appointmentMonths: [],
    busyHours: [],
    retailMonths: [],
    expenseGroups: [],
    purchaseMonths: [],
    productMonths: [],
    inventoryProducts: [],
    ...overrides,
  };
}

describe("getReportExportData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "America/Panama", created_at: "2025-01-01T00:00:00.000Z" });
    mockedHistorical.mockResolvedValue(historicalRows());
  });

  it("usa el nombre y la zona horaria por defecto cuando el salon no tiene identidad", async () => {
    mockedIdentity.mockResolvedValue(null);

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(data).toMatchObject({ salonName: "GlowBook", timezone: "America/Panama" });
    expect(mockedHistorical).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: "salon-1", timezone: "America/Panama" })
    );
  });

  it("exporta el historico completo con el rango amplio y su etiqueta de totales", async () => {
    mockedHistorical.mockResolvedValue(
      historicalRows({
        appointmentMonths: [
          { monthKey: "2026-04", completedRevenue: 300, completedCount: 3 },
          { monthKey: "2026-05", completedRevenue: 100, completedCount: 1 },
        ],
      })
    );

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(mockedHistorical).toHaveBeenCalledWith({
      salonId: "salon-1",
      start: LIFETIME_RANGE.start,
      end: LIFETIME_RANGE.end,
      timezone: "America/Panama",
    });
    expect(data.scopeLabel).toBe("histórico completo");
    expect(data.totalsSuffix).toBe("(histórico)");
    expect(data.months.map((row) => row.monthKey)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(data.months[2]).toMatchObject({ monthKey: "2026-06", completedAppointments: 0, profit: 0 });
    expect(data.totals).toMatchObject({ appointmentRevenue: 400, completedAppointments: 4, estimatedProfit: 400 });
    expect(data.generatedAtLabel.length).toBeGreaterThan(0);
  });

  it("exporta un mes puntual con su rango UTC y devuelve una fila en cero si no hubo movimientos", async () => {
    const data = await getReportExportData(
      "salon-1",
      ALL_MODULES,
      { type: "month", monthKey: "2026-05" },
      NOW
    );

    expect(mockedHistorical).toHaveBeenCalledWith({
      salonId: "salon-1",
      start: "2026-05-01T05:00:00.000Z",
      end: "2026-06-01T04:59:59.999Z",
      timezone: "America/Panama",
    });
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

  it("exporta un año calendario con su etiqueta y limita la serie al ultimo mes del año", async () => {
    mockedHistorical.mockResolvedValue(
      historicalRows({
        appointmentMonths: [{ monthKey: "2025-03", completedRevenue: 50, completedCount: 1 }],
      })
    );

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "year", year: 2025 }, NOW);

    expect(data.scopeLabel).toBe("año 2025");
    expect(data.totalsSuffix).toBe("(año 2025)");
    expect(data.months.at(-1)?.monthKey).toBe("2025-12");
    expect(data.months[0]?.monthKey).toBe("2025-03");
    expect(mockedHistorical).toHaveBeenCalledWith(expect.objectContaining({ start: "2025-01-01T05:00:00.000Z" }));
  });

  it("agrupa los gastos por concepto y los ordena de mayor a menor cuando el modulo esta activo", async () => {
    mockedHistorical.mockResolvedValue(
      historicalRows({
        expenseGroups: [
          { monthKey: "2026-05", label: "Alquiler", amount: 200 },
          { monthKey: "2026-06", label: "Alquiler", amount: 200 },
          { monthKey: "2026-06", label: "Luz", amount: 80 },
        ],
      })
    );

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(data.expenseConcepts).toEqual([
      { label: "Alquiler", amount: 400 },
      { label: "Luz", amount: 80 },
    ]);
  });

  it("agrupa los productos vendidos por nombre y los ordena por cantidad", async () => {
    mockedHistorical.mockResolvedValue(
      historicalRows({
        productMonths: [
          { productId: "p1", productName: "Tinte", monthKey: "2026-05", quantity: 2 },
          { productId: "p1", productName: "Tinte", monthKey: "2026-06", quantity: 3 },
          { productId: "p2", productName: "Shampoo", monthKey: "2026-06", quantity: 9 },
        ],
      })
    );

    const data = await getReportExportData("salon-1", ALL_MODULES, { type: "lifetime" }, NOW);

    expect(data.productTotals).toEqual([
      { name: "Shampoo", quantity: 9 },
      { name: "Tinte", quantity: 5 },
    ]);
  });

  it("omite gastos y ventas de productos cuando esos modulos estan desactivados", async () => {
    mockedHistorical.mockResolvedValue(
      historicalRows({
        expenseGroups: [{ monthKey: "2026-06", label: "Luz", amount: 80 }],
        productMonths: [{ productId: "p1", productName: "Tinte", monthKey: "2026-06", quantity: 2 }],
      })
    );

    const data = await getReportExportData(
      "salon-1",
      { inventory: false, retail: false, expenses: false },
      { type: "lifetime" },
      NOW
    );

    expect(data.expenseConcepts).toEqual([]);
    expect(data.productTotals).toEqual([]);
    expect(data.modules).toEqual({ inventory: false, retail: false, expenses: false });
  });
});
