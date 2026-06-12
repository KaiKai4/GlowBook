import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import {
  getReportExportData,
  type ReportExportData,
} from "@/features/reports/use-cases/get-report-export";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { captureError } from "@/lib/observability";

const CURRENCY_FORMAT = '"$"#,##0.00';

function headerRow(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
}

function buildWorkbook(data: ReportExportData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GlowBook";

  // ── Resumen: acumulado historico ───────────────────────────────────────────
  const summary = workbook.addWorksheet("Resumen");
  summary.columns = [
    { header: "Concepto", key: "label", width: 38 },
    { header: "Valor", key: "value", width: 18 },
  ];
  headerRow(summary);

  const summaryRows: Array<[string, number | string, boolean]> = [
    ["Salón", data.salonName, false],
    ["Generado", data.generatedAtLabel, false],
    ["", "", false],
    ["Citas completadas (histórico)", data.totals.completedAppointments, false],
    ["Ingresos por citas (histórico)", data.totals.appointmentRevenue, true],
    ...(data.modules.retail
      ? [["Ingresos por vitrina (histórico)", data.totals.retailRevenue, true] as [string, number, boolean]]
      : []),
    ["Ingresos totales (histórico)", data.totals.grossRevenue, true],
    ...(data.modules.expenses
      ? [["Gastos operativos (histórico)", data.totals.operationalExpenses, true] as [string, number, boolean]]
      : []),
    ...(data.modules.inventory
      ? [["Compras de inventario (histórico)", data.totals.inventoryPurchases, true] as [string, number, boolean]]
      : []),
    ["Egresos totales (histórico)", data.totals.totalExpenses, true],
    ["Ganancia (histórico)", data.totals.estimatedProfit, true],
  ];
  for (const [label, value, isCurrency] of summaryRows) {
    const row = summary.addRow({ label, value });
    if (isCurrency) row.getCell("value").numFmt = CURRENCY_FORMAT;
  }

  // ── Por mes: la serie completa desde el primer movimiento ──────────────────
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

  const currencyKeys = [
    "appointmentRevenue",
    "retailRevenue",
    "grossRevenue",
    "operationalExpenses",
    "inventoryPurchases",
    "totalExpenses",
    "profit",
  ];
  for (const month of data.months) {
    const row = monthly.addRow(month);
    for (const key of currencyKeys) {
      const cell = row.getCell(key);
      if (typeof cell.value === "number") cell.numFmt = CURRENCY_FORMAT;
    }
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
    for (const key of currencyKeys) {
      const cell = totalRow.getCell(key);
      if (typeof cell.value === "number") cell.numFmt = CURRENCY_FORMAT;
    }
  }

  // ── Gastos por concepto ─────────────────────────────────────────────────────
  if (data.modules.expenses && data.expenseConcepts.length > 0) {
    const expenses = workbook.addWorksheet("Gastos por concepto");
    expenses.columns = [
      { header: "Concepto", key: "label", width: 36 },
      { header: "Total histórico", key: "amount", width: 18 },
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
      { header: "Unidades (histórico)", key: "quantity", width: 20 },
    ];
    headerRow(products);
    for (const product of data.productTotals) {
      products.addRow(product);
    }
  }

  return workbook;
}

export async function GET() {
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!hasPermission(profile, PERMISSIONS.REPORTS_VIEW)) {
    return NextResponse.json({ error: "No tienes permiso para exportar reportes." }, { status: 403 });
  }

  // Generar el archivo recorre todo el historico: limite ajustado por usuario.
  const limited = assertActionRateLimit(profile.id, "reports-export", {
    max: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  try {
    const modules = {
      inventory: await isEffectiveSalonModuleEnabled(profile, "inventory"),
      retail: await isEffectiveSalonModuleEnabled(profile, "retail"),
      expenses: await isEffectiveSalonModuleEnabled(profile, "expenses"),
    };
    const data = await getReportExportData(profile.salon_id, modules);
    const workbook = buildWorkbook(data);
    const buffer = await workbook.xlsx.writeBuffer();

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="glowbook-reportes-${today}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    captureError(error, { module: "reports", action: "export" });
    return NextResponse.json({ error: "No se pudo generar el archivo." }, { status: 500 });
  }
}
