import { utcBounds } from "@/lib/utils/dates";
import {
  findHistoricalReportRows,
  findSalonReportIdentity,
  findSalonTimezone,
} from "../data/reports.repo";
import {
  fetchCommissionReport,
  fetchOperationalBreakdown,
  fetchPeriodTotals,
} from "../data/rpc/reports-read-models.rpc";
import {
  calculateHistoricalReportAnalytics,
  calculateLifetimeTotals,
  type HistoricalReportAnalytics,
  type LifetimeReportTotals,
  type ReportModuleAvailability,
} from "../domain/analytics";
import type { OperationalReportMetrics } from "../domain/metrics";
import {
  availableReportYears,
  getReportPresetRange,
  getYearRange,
  localDateString,
  localYear,
} from "../domain/period";
import type { ReportFilters, SelectedReportPreset } from "../schemas";

const DEFAULT_REPORT_TIMEZONE = "America/Panama";

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

function getMonthSequence(now: Date, timezone: string, count = 12) {
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

function lastDayOfMonth(monthKey: string): string {
  const [year = NaN, month = NaN] = monthKey.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export async function getOperationalReport({
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
      salonId,
      filters,
      modules,
      now,
      timezone,
    }),
    getHistoricalAnalytics({ salonId, modules, now, timezone }),
    getYearTotals({ salonId, modules, timezone, year: selectedYear }),
  ]);

  return { ...period, analytics, yearly, selectedYear, availableYears };
}

// Limites fijos lejanos: para alcances "histórico completo" hay salones con
// movimientos anteriores a su creacion (historial importado, datos
// retroactivos). La RPC agrega en SQL, asi que el rango amplio no trae filas
// crudas. (Se mantiene para la exportacion del histórico completo.)
export const LIFETIME_RANGE = {
  start: "0001-01-01T00:00:00.000Z",
  end: "9999-12-31T23:59:59.999Z",
} as const;

/**
 * Acumulado de un año calendario (1 de enero a 31 de diciembre, en la zona del
 * salon). Es lo que el dashboard muestra como "Acumulado del año": se reinicia
 * cada 1 de enero porque el año nuevo arranca sin movimientos, sin borrar nada.
 */
async function getYearTotals({
  salonId,
  modules,
  timezone,
  year,
}: {
  salonId: string;
  modules: ReportModuleAvailability;
  timezone: string;
  year: number;
}): Promise<LifetimeReportTotals> {
  const range = getYearRange(year);
  const { start, end } = utcBounds(range.from, range.to, timezone);
  const rows = await findHistoricalReportRows({ salonId, start, end, timezone });

  return calculateLifetimeTotals({ ...rows, modules });
}

interface GetOperationalReportPeriodInternalInput extends GetOperationalReportInput {
  timezone?: string;
}

async function getOperationalReportPeriod({
  salonId,
  filters,
  modules = { inventory: true, retail: true, expenses: true },
  now = new Date(),
  timezone: knownTimezone,
}: GetOperationalReportPeriodInternalInput): Promise<OperationalReportPeriodViewModel> {
  const timezone = knownTimezone ?? (await findSalonTimezone(salonId)) ?? DEFAULT_REPORT_TIMEZONE;
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

async function getHistoricalAnalytics({
  salonId,
  modules,
  now,
  timezone,
}: {
  salonId: string;
  modules: ReportModuleAvailability;
  now: Date;
  timezone: string;
}): Promise<HistoricalReportAnalytics> {
  const months = getMonthSequence(now, timezone);
  const firstMonth = months[0];
  const lastMonth = months.at(-1);
  if (!firstMonth || !lastMonth) throw new Error("Invariante de reporte: sin meses para el historial.");
  const historyBounds = utcBounds(
    `${firstMonth.monthKey}-01`,
    lastDayOfMonth(lastMonth.monthKey),
    timezone
  );
  const historicalRows = await findHistoricalReportRows({
    salonId,
    start: historyBounds.start,
    end: historyBounds.end,
    timezone,
  });

  return calculateHistoricalReportAnalytics({
    ...historicalRows,
    months,
    modules,
  });
}
