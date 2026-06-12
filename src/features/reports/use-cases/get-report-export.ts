import "server-only";

import { utcBounds } from "@/lib/utils/dates";
import { localDateString } from "../domain/period";
import { findHistoricalReportRows, findSalonReportIdentity } from "../data/reports.repo";
import {
  buildMonthlyExportRows,
  calculateLifetimeTotals,
  type LifetimeReportTotals,
  type MonthlyExportRow,
  type ReportModuleAvailability,
} from "../domain/analytics";

const DEFAULT_REPORT_TIMEZONE = "America/Panama";

export interface ReportExportData {
  salonName: string;
  generatedAtLabel: string;
  timezone: string;
  modules: ReportModuleAvailability;
  months: Array<MonthlyExportRow & { label: string }>;
  totals: LifetimeReportTotals;
  expenseConcepts: Array<{ label: string; amount: number }>;
  productTotals: Array<{ name: string; quantity: number }>;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("es-PA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, 15)));
}

/**
 * Todo el historico del salon listo para exportar: filas por mes (serie
 * continua desde el primer movimiento) + totales acumulados, respetando los
 * modulos activos del plan.
 */
export async function getReportExportData(
  salonId: string,
  modules: ReportModuleAvailability,
  now = new Date()
): Promise<ReportExportData> {
  const identity = await findSalonReportIdentity(salonId);
  const timezone = identity?.timezone ?? DEFAULT_REPORT_TIMEZONE;
  const fromDate = (identity?.created_at ?? "2024-01-01").slice(0, 10);
  const toDate = localDateString(now, timezone);
  const bounds = utcBounds(fromDate, toDate, timezone);

  const rows = await findHistoricalReportRows({
    salonId,
    start: bounds.start,
    end: bounds.end,
    timezone,
  });

  const input = { ...rows, modules };
  const currentMonthKey = toDate.slice(0, 7);

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

  return {
    salonName: identity?.name ?? "GlowBook",
    generatedAtLabel: new Intl.DateTimeFormat("es-PA", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: timezone,
    }).format(now),
    timezone,
    modules,
    months: buildMonthlyExportRows(input, currentMonthKey).map((row) => ({
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
