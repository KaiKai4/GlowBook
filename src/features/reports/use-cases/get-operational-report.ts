import { utcBounds } from "@/lib/utils/dates";
import { calculateOperationalMoneyTotals } from "@/features/finance/domain/operational-money";
import { getExternalOperationalMoney } from "@/features/finance/use-cases/operational-money";
import { findOperationalReportRows, findSalonTimezone } from "../data/reports.repo";
import {
  calculateOperationalReportMetrics,
  type OperationalReportMetrics,
} from "../domain/metrics";
import { getReportPresetRange } from "../domain/period";
import type { ReportFilters, SelectedReportPreset } from "../schemas";

const DEFAULT_REPORT_TIMEZONE = "America/Panama";

export interface OperationalReportViewModel extends OperationalReportMetrics {
  from: string;
  to: string;
  preset: SelectedReportPreset;
  newCustomers: number;
}

export interface GetOperationalReportInput {
  salonId: string;
  filters: ReportFilters;
  now?: Date;
}

export async function getOperationalReport({
  salonId,
  filters,
  now = new Date(),
}: GetOperationalReportInput): Promise<OperationalReportViewModel> {
  const timezone = (await findSalonTimezone(salonId)) ?? DEFAULT_REPORT_TIMEZONE;
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
    retailRevenue: externalMoney.retailRevenue,
    manualExpenses: externalMoney.manualExpenses,
    inventoryPurchases: externalMoney.inventoryPurchases,
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
  };
}
