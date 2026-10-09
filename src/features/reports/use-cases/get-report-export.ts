import "server-only";

import { findSalonReportIdentity } from "../data/reports.repo";
import { fetchPeriodTotals } from "../data/rpc/reports-read-models.rpc";
import {
  fetchExpenseConcepts,
  fetchMonthlySeries,
  fetchProductSales,
  type MonthlySeriesRow,
} from "../data/rpc/reports-history.rpc";
import {
  trimMonthlyRows,
  type LifetimeReportTotals,
  type MonthlyExportRow,
  type ReportModuleAvailability,
} from "../domain/analytics";
import { getYearRange, localDateString, localYear } from "../domain/period";
import { lastDayOfMonth, toLifetimeTotals } from "./get-operational-report";

const DEFAULT_REPORT_TIMEZONE = "America/Panama";
// Historico completo: la base agrega en la ventana amplia y los meses sin movimientos
// salen en cero; trimMonthlyRows recorta la serie al primer y ultimo mes con movimientos.
const LIFETIME_FIRST_MONTH = "1970-01";
const LIFETIME_FIRST_DAY = "1970-01-01";
// Sin tope de productos en la exportacion: maximo entero de PostgreSQL (LIMIT).
const ALL_PRODUCTS_LIMIT = 2147483647;

/** Alcance del archivo: un mes puntual, un año calendario o toda la vida. */
export type ReportExportScope =
  | { type: "lifetime" }
  | { type: "year"; year: number }
  | { type: "month"; monthKey: string };

export interface ReportExportData {
  salonName: string;
  generatedAtLabel: string;
  timezone: string;
  modules: ReportModuleAvailability;
  /** "histórico" o el nombre del mes: aparece en titulos y etiquetas. */
  scopeLabel: string;
  /** Sufijo de las filas del resumen, p. ej. "(histórico)" o "(junio 2026)". */
  totalsSuffix: string;
  months: Array<MonthlyExportRow & { label: string }>;
  totals: LifetimeReportTotals;
  expenseConcepts: Array<{ label: string; amount: number }>;
  productTotals: Array<{ name: string; quantity: number }>;
}

interface ExportBounds {
  /** Dia local inicial y final (YYYY-MM-DD) del alcance. */
  from: string;
  to: string;
  /** Meses (YYYY-MM) de la serie mensual que cubren el alcance. */
  firstMonth: string;
  lastMonth: string;
  /** Mes hasta el que la serie se rellena: el del alcance o el mes en curso. */
  currentMonthKey: string;
}

function monthLabel(monthKey: string): string {
  const [year = NaN, month = NaN] = monthKey.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("es-PA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, 15)));
}

function exportBounds(scope: ReportExportScope, timezone: string, now: Date): ExportBounds {
  if (scope.type === "month") {
    return {
      from: `${scope.monthKey}-01`,
      to: lastDayOfMonth(scope.monthKey),
      firstMonth: scope.monthKey,
      lastMonth: scope.monthKey,
      currentMonthKey: scope.monthKey,
    };
  }
  if (scope.type === "year") {
    const range = getYearRange(scope.year);
    return {
      from: range.from,
      to: range.to,
      firstMonth: `${scope.year}-01`,
      lastMonth: `${scope.year}-12`,
      currentMonthKey: `${scope.year}-12`,
    };
  }
  // El ultimo año de la ventana queda un año por delante del actual: cubre movimientos
  // con fecha futura sin consultar un limite que dependa de los datos.
  const lastYear = localYear(now, timezone) + 1;
  return {
    from: LIFETIME_FIRST_DAY,
    to: `${lastYear}-12-31`,
    firstMonth: LIFETIME_FIRST_MONTH,
    lastMonth: `${lastYear}-12`,
    currentMonthKey: localDateString(now, timezone).slice(0, 7),
  };
}

function toExportRow(row: MonthlySeriesRow): MonthlyExportRow {
  return {
    monthKey: row.monthKey,
    completedAppointments: row.completedAppointments,
    appointmentRevenue: row.appointmentRevenue,
    retailRevenue: row.retailRevenue,
    grossRevenue: row.grossRevenue,
    operationalExpenses: row.operationalExpenses,
    inventoryPurchases: row.inventoryPurchases,
    totalExpenses: row.totalExpenses,
    profit: row.profit,
  };
}

// Un mes sin movimientos igual exporta su fila en cero: un archivo vacio
// parece un error, una fila en cero responde la pregunta.
function withMonthFallback(
  rows: MonthlyExportRow[],
  scope: ReportExportScope
): MonthlyExportRow[] {
  if (rows.length > 0 || scope.type !== "month") return rows;
  return [
    {
      monthKey: scope.monthKey,
      completedAppointments: 0,
      appointmentRevenue: 0,
      retailRevenue: 0,
      grossRevenue: 0,
      operationalExpenses: 0,
      inventoryPurchases: 0,
      totalExpenses: 0,
      profit: 0,
    },
  ];
}

/**
 * Datos listos para exportar segun el alcance: filas por mes (serie continua)
 * + totales, respetando los modulos activos del plan. Para el alcance mensual
 * la "serie" es ese unico mes y los totales son los de ese mes.
 */
export async function getReportExportData(
  salonId: string,
  modules: ReportModuleAvailability,
  scope: ReportExportScope = { type: "lifetime" },
  now = new Date()
): Promise<ReportExportData> {
  const identity = await findSalonReportIdentity(salonId);
  const timezone = identity?.timezone ?? DEFAULT_REPORT_TIMEZONE;
  const bounds = exportBounds(scope, timezone, now);

  const [series, totals, expenseConcepts, productSales] = await Promise.all([
    fetchMonthlySeries({ firstMonth: bounds.firstMonth, lastMonth: bounds.lastMonth, timezone, modules }),
    fetchPeriodTotals({ from: bounds.from, to: bounds.to, timezone, modules }),
    fetchExpenseConcepts({ from: bounds.from, to: bounds.to, modules, includeRestock: false }),
    fetchProductSales({
      firstMonth: bounds.firstMonth,
      lastMonth: bounds.lastMonth,
      timezone,
      modules,
      limit: ALL_PRODUCTS_LIMIT,
    }),
  ]);

  const scopeLabel =
    scope.type === "month"
      ? monthLabel(scope.monthKey)
      : scope.type === "year"
        ? `año ${scope.year}`
        : "histórico completo";

  const exportRows = withMonthFallback(
    trimMonthlyRows(series.map(toExportRow), bounds.currentMonthKey),
    scope
  );

  return {
    salonName: identity?.name ?? "GlowBook",
    generatedAtLabel: new Intl.DateTimeFormat("es-PA", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: timezone,
    }).format(now),
    timezone,
    modules,
    scopeLabel,
    totalsSuffix: scope.type === "lifetime" ? "(histórico)" : `(${scopeLabel})`,
    months: exportRows.map((row) => ({
      ...row,
      label: monthLabel(row.monthKey),
    })),
    totals: toLifetimeTotals(totals),
    expenseConcepts: expenseConcepts.map((concept) => ({ label: concept.label, amount: concept.amount })),
    productTotals: productSales.map((product) => ({ name: product.name, quantity: product.total })),
  };
}
