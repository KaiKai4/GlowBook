import ExcelJS from "exceljs";

import type { ReportExportData } from "@/features/reports/use-cases/get-report-export";

const CURRENCY_FORMAT = '"$"#,##0.00';

function headerRow(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
}

// Solo las columnas de moneda que EXISTEN en la hoja: pedir una clave que no
// esta en sheet.columns hace que exceljs la interprete como direccion de
// columna y explote ("Out of bounds").
function monthlyCurrencyKeys(data: ReportExportData): string[] {
  return [
    "appointmentRevenue",
    ...(data.modules.retail ? ["retailRevenue"] : []),
    "grossRevenue",
    ...(data.modules.expenses ? ["operationalExpenses"] : []),
    ...(data.modules.inventory ? ["inventoryPurchases"] : []),
    "totalExpenses",
    "profit",
  ];
}

export function buildReportWorkbook(data: ReportExportData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GlowBook";

  // ── Resumen ─────────────────────────────────────────────────────────────────
  const summary = workbook.addWorksheet("Resumen");
  summary.columns = [
    { header: "Concepto", key: "label", width: 38 },
    { header: "Valor", key: "value", width: 22 },
  ];
  headerRow(summary);

  const suffix = data.totalsSuffix;
  const summaryRows: Array<[string, number | string, boolean]> = [
    ["Salón", data.salonName, false],
    ["Alcance", data.scopeLabel, false],
    ["Generado", data.generatedAtLabel, false],
    ["", "", false],
    [`Citas completadas ${suffix}`, data.totals.completedAppointments, false],
    [`Ingresos por citas ${suffix}`, data.totals.appointmentRevenue, true],
    ...(data.modules.retail
      ? [[`Ingresos por vitrina ${suffix}`, data.totals.retailRevenue, true] as [string, number, boolean]]
      : []),
    [`Ingresos totales ${suffix}`, data.totals.grossRevenue, true],
    ...(data.modules.expenses
      ? [[`Gastos operativos ${suffix}`, data.totals.operationalExpenses, true] as [string, number, boolean]]
      : []),
    ...(data.modules.inventory
      ? [[`Compras de inventario ${suffix}`, data.totals.inventoryPurchases, true] as [string, number, boolean]]
      : []),
    [`Egresos totales ${suffix}`, data.totals.totalExpenses, true],
    [`Ganancia ${suffix}`, data.totals.estimatedProfit, true],
  ];
  for (const [label, value, isCurrency] of summaryRows) {
    const row = summary.addRow({ label, value });
    if (isCurrency) row.getCell("value").numFmt = CURRENCY_FORMAT;
  }

  // ── Por mes ─────────────────────────────────────────────────────────────────
  const monthly = workbook.addWorksheet("Por mes");
  monthly.columns = [
    { header: "Mes", key: "label", width: 20 },
    { header: "Citas completadas", key: "completedAppointments", width: 18 },
    { header: "Ingresos citas", key: "appointmentRevenue", width: 16 },
    ...(data.modules.retail
      ? [{ header: "Ingresos vitrina", key: "retailRevenue", width: 16 }]
      : []),
    { header: "Ingresos totales", key: "grossRevenue", width: 16 },
    ...(data.modules.expenses
      ? [{ header: "Gastos operativos", key: "operationalExpenses", width: 17 }]
      : []),
    ...(data.modules.inventory
      ? [{ header: "Compras inventario", key: "inventoryPurchases", width: 18 }]
      : []),
    { header: "Egresos totales", key: "totalExpenses", width: 16 },
    { header: "Ganancia", key: "profit", width: 14 },
  ];
  headerRow(monthly);

  const currencyKeys = monthlyCurrencyKeys(data);
  const formatCurrencyCells = (row: ExcelJS.Row) => {
    for (const key of currencyKeys) {
      const cell = row.getCell(key);
      if (typeof cell.value === "number") cell.numFmt = CURRENCY_FORMAT;
    }
  };

  for (const month of data.months) {
    formatCurrencyCells(monthly.addRow(month));
  }

  if (data.months.length > 0) {
    const totalRow = monthly.addRow({
      label: "TOTAL",
      completedAppointments: data.totals.completedAppointments,
      appointmentRevenue: data.totals.appointmentRevenue,
      retailRevenue: data.totals.retailRevenue,
      grossRevenue: data.totals.grossRevenue,
      operationalExpenses: data.totals.operationalExpenses,
      inventoryPurchases: data.totals.inventoryPurchases,
      totalExpenses: data.totals.totalExpenses,
      profit: data.totals.estimatedProfit,
    });
    totalRow.font = { bold: true };
    formatCurrencyCells(totalRow);
  }

  // ── Gastos por concepto ─────────────────────────────────────────────────────
  if (data.modules.expenses && data.expenseConcepts.length > 0) {
    const expenses = workbook.addWorksheet("Gastos por concepto");
    expenses.columns = [
      { header: "Concepto", key: "label", width: 36 },
      { header: `Total ${data.scopeLabel}`, key: "amount", width: 24 },
    ];
    headerRow(expenses);
    for (const concept of data.expenseConcepts) {
      const row = expenses.addRow(concept);
      row.getCell("amount").numFmt = CURRENCY_FORMAT;
    }
  }

  // ── Productos vendidos ─────────────────────────────────────────────────────
  if (data.modules.retail && data.productTotals.length > 0) {
    const products = workbook.addWorksheet("Productos vendidos");
    products.columns = [
      { header: "Producto", key: "name", width: 36 },
      { header: `Unidades · ${data.scopeLabel}`, key: "quantity", width: 24 },
    ];
    headerRow(products);
    for (const product of data.productTotals) {
      products.addRow(product);
    }
  }

  return workbook;
}
