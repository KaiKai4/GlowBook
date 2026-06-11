import { utcBounds } from "@/lib/utils/dates";
import { calculateOperationalMoneyTotals } from "@/features/finance/domain/operational-money";
import { getExternalOperationalMoney } from "@/features/finance/use-cases/operational-money";
import {
  findHistoricalReportRows,
  findOperationalReportRows,
  findSalonTimezone,
} from "../data/reports.repo";
import {
  calculateHistoricalReportAnalytics,
  type HistoricalReportAnalytics,
  type ReportModuleAvailability,
} from "../domain/analytics";
import {
  calculateOperationalReportMetrics,
  type OperationalReportMetrics,
} from "../domain/metrics";
import { getReportPresetRange, localDateString } from "../domain/period";
import type { ReportFilters, SelectedReportPreset } from "../schemas";

const DEFAULT_REPORT_TIMEZONE = "America/Panama";

export interface OperationalReportPeriodViewModel extends OperationalReportMetrics {
  from: string;
  to: string;
  preset: SelectedReportPreset;
  newCustomers: number;
  modules: ReportModuleAvailability;
}

export interface OperationalReportViewModel extends OperationalReportPeriodViewModel {
  analytics: HistoricalReportAnalytics;
}

export interface GetOperationalReportInput {
  salonId: string;
  filters: ReportFilters;
  modules?: ReportModuleAvailability;
  now?: Date;
}

function getMonthSequence(now: Date, timezone: string, count = 12) {
  const currentMonthKey = localDateString(now, timezone).slice(0, 7);
  const [year, month] = currentMonthKey.split("-").map(Number);
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
  const [year, month] = monthKey.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export async function getOperationalReport({
  salonId,
  filters,
  modules = { inventory: true, retail: true, expenses: true },
  now = new Date(),
}: GetOperationalReportInput): Promise<OperationalReportViewModel> {
  const timezone = (await findSalonTimezone(salonId)) ?? DEFAULT_REPORT_TIMEZONE;
  const [period, analytics] = await Promise.all([
    getOperationalReportPeriod({
      salonId,
      filters,
      modules,
      now,
      timezone,
    }),
    getHistoricalAnalytics({ salonId, modules, now, timezone }),
  ]);

  return { ...period, analytics };
}

interface GetOperationalReportPeriodInternalInput extends GetOperationalReportInput {
  timezone?: string;
}

export async function getOperationalReportPeriod({
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
  const { start, end } = utcBounds(range.from, range.to, timezone);
  const [rows, externalMoney] = await Promise.all([
    findOperationalReportRows({ salonId, start, end }),
    getExternalOperationalMoney({
      salonId,
      fromIso: start,
      toIso: end,
      fromDate: range.from,
      toDate: range.to,
    }),
  ]);
  const metrics = calculateOperationalReportMetrics(rows.appointments, rows.items);
  const money = calculateOperationalMoneyTotals({
    appointmentRevenue: metrics.revenue,
    retailRevenue: modules.retail ? externalMoney.retailRevenue : 0,
    manualExpenses: modules.expenses ? externalMoney.manualExpenses : 0,
    inventoryPurchases: modules.inventory ? externalMoney.inventoryPurchases : 0,
  });

  return {
    ...range,
    preset: hasCustomRange ? "custom" : filters.preset,
    ...metrics,
    retailRevenue: money.retailRevenue,
    grossRevenue: money.grossRevenue,
    manualExpenses: money.manualExpenses,
    inventoryPurchases: money.inventoryPurchases,
    totalExpenses: money.totalExpenses,
    estimatedProfit: money.estimatedProfit,
    newCustomers: rows.newCustomers,
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
  const historyBounds = utcBounds(
    `${months[0].monthKey}-01`,
    lastDayOfMonth(months.at(-1)!.monthKey),
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
