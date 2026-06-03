import { utcBounds } from "@/lib/utils/dates";
import { sumExpensesTotal } from "@/features/expenses/data/expenses.repo";
import { sumInventoryPurchasesTotal } from "@/features/inventory/data/inventory.repo";
import { sumRetailSalesTotal } from "@/features/retail/data/retail.repo";
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
  const [rows, retailRevenue, manualExpenses, inventoryPurchases] = await Promise.all([
    findOperationalReportRows({ salonId, start, end }),
    sumRetailSalesTotal(salonId, start, end),
    sumExpensesTotal(salonId, range.from, range.to),
    sumInventoryPurchasesTotal(salonId, range.from, range.to),
  ]);
  const metrics = calculateOperationalReportMetrics(rows.appointments, rows.items);
  const grossRevenue = metrics.revenue + retailRevenue;
  const totalExpenses = manualExpenses + inventoryPurchases;
  const estimatedProfit = grossRevenue - totalExpenses;

  return {
    ...range,
    preset: hasCustomRange ? "custom" : filters.preset,
    ...metrics,
    retailRevenue,
    grossRevenue,
    manualExpenses,
    inventoryPurchases,
    totalExpenses,
    estimatedProfit,
    newCustomers: rows.newCustomers,
  };
}
