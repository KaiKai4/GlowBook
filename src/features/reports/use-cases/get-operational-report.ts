import { requireInvariant } from "@/infra/invariant";
import { toResult } from "@/infra/to-result";
import type { Result } from "@/infra/result";
import { findSalonReportIdentity } from "../data/reports.repo";
import {
  fetchCommissionReport,
  fetchOperationalBreakdown,
  fetchPeriodTotals,
} from "../data/rpc/reports-read-models.rpc";
import {
  fetchBusyHours,
  fetchExpenseConcepts,
  fetchInventoryAlerts,
  fetchMonthlySeries,
  fetchProductSales,
  type MonthlySeriesRow,
} from "../data/rpc/reports-history.rpc";
import {
  busyHourLabel,
  toLifetimeTotals,
  type HistoricalReportAnalytics,
  type LifetimeReportTotals,
  type ReportModuleAvailability,
  type ReportMonthPoint,
} from "../domain/analytics";
import type { OperationalReportMetrics } from "../domain/metrics";
import {
  availableReportYears,
  getReportPresetRange,
  getYearRange,
  lastDayOfMonth,
  localDateString,
  localYear,
} from "../domain/period";
import type { ReportFilters, SelectedReportPreset } from "../schemas";

/** Meses de la serie mensual del reporte operativo. */
const MONTHS_IN_SERIES = 12;

const DEFAULT_REPORT_TIMEZONE = "America/Panama";
const TOP_LIMIT = 5;

interface OperationalReportPeriodViewModel extends OperationalReportMetrics {
  from: string;
  to: string;
  preset: SelectedReportPreset;
  newCustomers: number;
  modules: ReportModuleAvailability;
}

export interface OperationalReportViewModel extends OperationalReportPeriodViewModel {
  analytics: HistoricalReportAnalytics;
  /** Acumulado del año seleccionado: se reinicia cada 1 de enero. */
  yearly: LifetimeReportTotals;
  /** Año del acumulado mostrado. */
  selectedYear: number;
  /** Años con datos consultables, del más reciente al más antiguo. */
  availableYears: number[];
}

export interface GetOperationalReportInput {
  salonId: string;
  filters: ReportFilters;
  modules?: ReportModuleAvailability;
  /** Año del acumulado; por defecto el año en curso. */
  year?: number;
  now?: Date;
}

interface MonthLabel {
  monthKey: string;
  label: string;
}

function getMonthSequence(now: Date, timezone: string, count = MONTHS_IN_SERIES): MonthLabel[] {
  const currentMonthKey = localDateString(now, timezone).slice(0, 7);
  const [year = NaN, month = NaN] = currentMonthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-PA", { month: "short", timeZone: "UTC" });

  return Array.from({ length: count }, (_, index) => {
    const absolute = year * 12 + month - 1 - (count - 1 - index);
    const pointYear = Math.floor(absolute / 12);
    const pointMonth = (absolute % 12) + 1;
    return {
      monthKey: `${pointYear}-${String(pointMonth).padStart(2, "0")}`,
      label: label.format(new Date(Date.UTC(pointYear, pointMonth - 1, 15))).replace(".", ""),
    };
  });
}

async function buildOperationalReport({
  salonId,
  filters,
  modules = { inventory: true, retail: true, expenses: true },
  year,
  now = new Date(),
}: GetOperationalReportInput): Promise<OperationalReportViewModel> {
  const identity = await findSalonReportIdentity(salonId);
  const timezone = identity?.timezone ?? DEFAULT_REPORT_TIMEZONE;

  const currentYear = localYear(now, timezone);
  const earliestYear = identity?.created_at
    ? localYear(new Date(identity.created_at), timezone)
    : currentYear;
  const availableYears = availableReportYears(earliestYear, currentYear);
  // Solo se consultan años con datos; un año fuera de rango cae al actual.
  const selectedYear = year && availableYears.includes(year) ? year : currentYear;

  const [period, analytics, yearly] = await Promise.all([
    getOperationalReportPeriod({
      filters,
      modules,
      now,
      timezone,
    }),
    getHistoricalAnalytics({ modules, now, timezone }),
    getYearTotals({ modules, timezone, year: selectedYear }),
  ]);

  return { ...period, analytics, yearly, selectedYear, availableYears };
}

/**
 * Acumulado de un año calendario (1 de enero a 31 de diciembre, en la zona del
 * salon). Es lo que el dashboard muestra como "Acumulado del año": se reinicia
 * cada 1 de enero porque el año nuevo arranca sin movimientos, sin borrar nada.
 */
async function getYearTotals({
  modules,
  timezone,
  year,
}: {
  modules: ReportModuleAvailability;
  timezone: string;
  year: number;
}): Promise<LifetimeReportTotals> {
  const range = getYearRange(year);
  const totals = await fetchPeriodTotals({ from: range.from, to: range.to, timezone, modules });
  return toLifetimeTotals(totals);
}

interface GetOperationalReportPeriodInternalInput {
  filters: ReportFilters;
  modules: ReportModuleAvailability;
  now: Date;
  /** Zona del salón, ya resuelta por el caso de uso que llama. */
  timezone: string;
}

async function getOperationalReportPeriod({
  filters,
  modules,
  now,
  timezone,
}: GetOperationalReportPeriodInternalInput): Promise<OperationalReportPeriodViewModel> {
  const hasCustomRange = Boolean(filters.from && filters.to);
  const range = hasCustomRange
    ? { from: filters.from as string, to: filters.to as string }
    : getReportPresetRange(filters.preset, timezone, now);
  const [totals, breakdown, commissions] = await Promise.all([
    fetchPeriodTotals({ from: range.from, to: range.to, timezone, modules }),
    fetchOperationalBreakdown({ from: range.from, to: range.to, timezone }),
    fetchCommissionReport({ from: range.from, to: range.to, timezone }),
  ]);

  return {
    ...range,
    preset: hasCustomRange ? "custom" : filters.preset,
    ...totals,
    statusBreakdown: breakdown.statusBreakdown,
    byEmployee: breakdown.byEmployee,
    byService: breakdown.byService,
    commissions,
    modules,
  };
}

/** Una fila de la serie por cada mes de la ventana, en el orden de la ventana. */
function toMonthPoints(series: MonthlySeriesRow[], months: MonthLabel[]): ReportMonthPoint[] {
  const rowsByMonth = new Map(series.map((row) => [row.monthKey, row]));
  return months.map((month) => {
    const row = requireInvariant(rowsByMonth.get(month.monthKey), "Invariante de reporte: la serie mensual no cubre el mes solicitado.");
    return {
      monthKey: month.monthKey,
      label: month.label,
      appointmentRevenue: row.appointmentRevenue,
      retailRevenue: row.retailRevenue,
      totalRevenue: row.grossRevenue,
      operationalExpenses: row.operationalExpenses,
      inventoryPurchases: row.inventoryPurchases,
      totalExpenses: row.totalExpenses,
      profit: row.profit,
      marginPct: row.marginPct,
      completedAppointments: row.completedAppointments,
    };
  });
}

async function getHistoricalAnalytics({
  modules,
  now,
  timezone,
}: {
  modules: ReportModuleAvailability;
  now: Date;
  timezone: string;
}): Promise<HistoricalReportAnalytics> {
  const months = getMonthSequence(now, timezone);
  const firstMonth = requireInvariant(months[0], "Invariante de reporte: sin meses para el historial.");
  const lastMonth = requireInvariant(months.at(-1), "Invariante de reporte: sin meses para el historial.");
  const from = `${firstMonth.monthKey}-01`;
  const to = lastDayOfMonth(lastMonth.monthKey);

  const [series, busyHours, topExpenses, productSales, inventoryAlerts] = await Promise.all([
    fetchMonthlySeries({ firstMonth: firstMonth.monthKey, lastMonth: lastMonth.monthKey, timezone, modules }),
    fetchBusyHours({ from, to, timezone }),
    fetchExpenseConcepts({ from, to, modules, includeRestock: true, limit: TOP_LIMIT }),
    fetchProductSales({
      firstMonth: firstMonth.monthKey,
      lastMonth: lastMonth.monthKey,
      timezone,
      modules,
      limit: TOP_LIMIT,
    }),
    fetchInventoryAlerts(modules),
  ]);

  return {
    months: toMonthPoints(series, months),
    busyHours: busyHours.map((bucket) => ({
      hour: bucket.hour,
      label: busyHourLabel(bucket.hour),
      total: bucket.total,
    })),
    productSales,
    topExpenses,
    inventoryAlerts,
  };
}

const REPORT_LOAD_FAILED_MESSAGE = "No se pudo cargar el reporte operativo.";

export async function getOperationalReport(
  input: GetOperationalReportInput
): Promise<Result<OperationalReportViewModel>> {
  return toResult(() => buildOperationalReport(input), {
    fallback: REPORT_LOAD_FAILED_MESSAGE,
    context: { module: "reports", action: "operational-report" },
  });
}
