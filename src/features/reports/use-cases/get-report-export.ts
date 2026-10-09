import "server-only";

import { utcBounds } from "@/lib/utils/dates";
import { getYearRange, localDateString } from "../domain/period";
import { findHistoricalReportRows, findSalonReportIdentity } from "../data/reports.repo";
import {
  buildMonthlyExportRows,
  calculateLifetimeTotals,
  type LifetimeReportTotals,
  type MonthlyExportRow,
  type ReportModuleAvailability,
} from "../domain/analytics";
import { LIFETIME_RANGE } from "./get-operational-report";

const DEFAULT_REPORT_TIMEZONE = "America/Panama";

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

function monthLabel(monthKey: string): string {
  const [year = NaN, month = NaN] = monthKey.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("es-PA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, 15)));
}

function lastDayOfMonth(monthKey: string): string {
  const [year = NaN, month = NaN] = monthKey.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function scopeBounds(scope: ReportExportScope, timezone: string): { start: string; end: string } {
  if (scope.type === "month") {
    return utcBounds(`${scope.monthKey}-01`, lastDayOfMonth(scope.monthKey), timezone);
  }
  if (scope.type === "year") {
    const range = getYearRange(scope.year);
    return utcBounds(range.from, range.to, timezone);
  }
  // Limites fijos lejanos: el histórico completo debe incluir movimientos
  // anteriores a la creacion del salon (historial importado, datos retroactivos).
  return { start: LIFETIME_RANGE.start, end: LIFETIME_RANGE.end };
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
  const bounds = scopeBounds(scope, timezone);

  const rows = await findHistoricalReportRows({
    salonId,
    start: bounds.start,
    end: bounds.end,
    timezone,
  });

  const input = { ...rows, modules };
  // Tope hasta donde la serie mensual rellena meses en cero: el mes/año del
  // alcance, o el mes en curso para el histórico.
  const currentMonthKey =
    scope.type === "month"
      ? scope.monthKey
      : scope.type === "year"
        ? `${scope.year}-12`
        : localDateString(now, timezone).slice(0, 7);

  const expenseConcepts = new Map<string, number>();
  if (modules.expenses) {
    for (const group of rows.expenseGroups) {
      expenseConcepts.set(group.label, (expenseConcepts.get(group.label) ?? 0) + group.amount);
    }
  }

  const productTotals = new Map<string, number>();
  if (modules.retail) {
    for (const bucket of rows.productMonths) {
      productTotals.set(
        bucket.productName,
        (productTotals.get(bucket.productName) ?? 0) + bucket.quantity
      );
    }
  }

  const scopeLabel =
    scope.type === "month"
      ? monthLabel(scope.monthKey)
      : scope.type === "year"
        ? `año ${scope.year}`
        : "histórico completo";

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
    months: withMonthFallback(buildMonthlyExportRows(input, currentMonthKey), scope).map((row) => ({
      ...row,
      label: monthLabel(row.monthKey),
    })),
    totals: calculateLifetimeTotals(input),
    expenseConcepts: [...expenseConcepts.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount),
    productTotals: [...productTotals.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity),
  };
}
