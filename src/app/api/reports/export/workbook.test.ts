import { describe, expect, it } from "vitest";
import type { ReportExportData } from "@/features/reports/use-cases/get-report-export";
import { buildReportWorkbook } from "./workbook";

function exportData(modules: ReportExportData["modules"]): ReportExportData {
  return {
    salonName: "Glow Studio",
    generatedAtLabel: "12 de junio de 2026, 10:00",
    timezone: "America/Panama",
    modules,
    scopeLabel: "histórico completo",
    totalsSuffix: "(histórico)",
    months: [
      {
        monthKey: "2026-05",
        label: "mayo de 2026",
        completedAppointments: 4,
        appointmentRevenue: 200,
        retailRevenue: 50,
        grossRevenue: 250,
        operationalExpenses: 30,
        inventoryPurchases: 20,
        totalExpenses: 50,
        profit: 200,
      },
    ],
    totals: {
      appointmentRevenue: 200,
      retailRevenue: 50,
      grossRevenue: 250,
      operationalExpenses: 30,
      inventoryPurchases: 20,
      totalExpenses: 50,
      estimatedProfit: 200,
      completedAppointments: 4,
    },
    expenseConcepts: [{ label: "Alquiler", amount: 30 }],
    productTotals: [{ name: "Aceite", quantity: 3 }],
  };
}

describe("report workbook", () => {
  it("builds every sheet when all modules are enabled", async () => {
    const workbook = buildReportWorkbook(
      exportData({ inventory: true, retail: true, expenses: true })
    );

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Resumen",
      "Por mes",
      "Gastos por concepto",
      "Productos vendidos",
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    // Un .xlsx es un contenedor ZIP: empieza por "PK".
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("does not crash when every optional module is disabled", async () => {
    // Regresion: getCell sobre una columna omitida por módulos deshabilitados
    // lanzaba "Out of bounds. Excel supports columns from 1 to 16384".
    const workbook = buildReportWorkbook(
      exportData({ inventory: false, retail: false, expenses: false })
    );

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Resumen", "Por mes"]);
    const monthly = workbook.getWorksheet("Por mes");
    expect(monthly?.columnCount).toBeGreaterThan(0);
    expect(monthly?.getRow(1).values).not.toContain("Ingresos vitrina");
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
