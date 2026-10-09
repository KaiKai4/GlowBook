import "server-only";

import { formatLocalDateISO, getUtcDayBoundaries } from "@/lib/utils/dates";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { findPendingConfirmationRows, type DashboardPendingConfirmationRow } from "../data/dashboard.repo";
import {
  fetchDashboardMetrics,
  fetchMonthlyAppointmentSeries,
  fetchTopServices,
  type DashboardMetricsRow,
  type MonthlyAppointmentSeriesRow,
} from "../data/rpc/dashboard-read-models.rpc";

export interface TopService {
  name: string;
  count: number;
  pct: number;
}

export interface PendingAppointmentConfirmation {
  id: string;
  customerName: string;
  phone: string | null;
  when: string;
}

export interface MonthlyAppointmentPoint {
  monthKey: string;
  label: string;
  total: number;
  delta: number;
  trend: "up" | "down" | "flat";
}

interface DashboardMetrics {
  todayAppointments: number;
  appointmentRevenue: number;
  retailRevenue: number;
  monthRevenue: number;
  monthExpenses: number;
  estimatedProfit: number;
  lowStockProducts: number;
  totalCustomers: number;
  completedThisMonth: number;
}

export interface DashboardOverview {
  metrics: DashboardMetrics | null;
  topServices: TopService[];
  monthlyCompletedAppointments: MonthlyAppointmentPoint[];
  pending: PendingAppointmentConfirmation[];
}

export interface GetDashboardOverviewInput {
  salonId: string;
  wantsReports: boolean;
  wantsConfirmations: boolean;
  now?: Date;
}

type RelatedOne<T> = T | T[] | null;

function firstRelation<T>(value: RelatedOne<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getMonthStart(now: Date, timezone: string): Date {
  const localDate = formatLocalDateISO(now, timezone);
  const [year, month] = localDate.split("-");
  let probe = new Date(`${year}-${month}-01T12:00:00.000Z`);
  const probeLocal = formatLocalDateISO(probe, timezone);

  if (probeLocal !== `${year}-${month}-01`) {
    const delta = probeLocal > `${year}-${month}-01` ? -12 : 12;
    probe = new Date(probe.getTime() + delta * 60 * 60_000);
  }

  return getUtcDayBoundaries(probe, timezone).start;
}

function getMonthSequence(monthStart: Date, timezone: string, count = 12) {
  const currentMonthKey = formatLocalDateISO(monthStart, timezone).slice(0, 7);
  const [currentYear = NaN, currentMonth = NaN] = currentMonthKey.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("es-PA", {
    timeZone: timezone,
    month: "short",
  });

  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const absoluteMonth = currentYear * 12 + (currentMonth - 1) - offset;
    const year = Math.floor(absoluteMonth / 12);
    const month = (absoluteMonth % 12) + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const labelDate = new Date(Date.UTC(year, month - 1, 15, 12));

    return {
      monthKey,
      label: formatter.format(labelDate).replace(".", ""),
    };
  });
}

// Los totales de dinero llegan ya calculados desde report_dashboard_metrics.
function toDashboardMetrics(row: DashboardMetricsRow): DashboardMetrics {
  return {
    todayAppointments: row.todayAppointments,
    appointmentRevenue: row.appointmentRevenue,
    retailRevenue: row.retailRevenue,
    monthRevenue: row.monthRevenue,
    monthExpenses: row.monthExpenses,
    estimatedProfit: row.estimatedProfit,
    lowStockProducts: row.lowStockProducts,
    totalCustomers: row.totalCustomers,
    completedThisMonth: row.completedThisMonth,
  };
}

function withMonthLabels(
  points: MonthlyAppointmentSeriesRow[],
  months: { monthKey: string; label: string }[]
): MonthlyAppointmentPoint[] {
  const labels = new Map(months.map((month) => [month.monthKey, month.label]));

  return points.map((point) => ({
    ...point,
    label: labels.get(point.monthKey) ?? point.monthKey,
  }));
}

function mapPendingConfirmations(
  rows: DashboardPendingConfirmationRow[],
  timezone: string
): PendingAppointmentConfirmation[] {
  const formatter = new Intl.DateTimeFormat("es-PA", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return rows.map((appointment) => {
    const customer = firstRelation(appointment.customer);

    return {
      id: appointment.id,
      customerName: customer ? `${customer.first_name} ${customer.last_name}` : "Cliente",
      phone: customer?.phone ?? null,
      when: appointment.start_time ? formatter.format(new Date(appointment.start_time)) : "",
    };
  });
}

export async function getDashboardOverview({
  salonId,
  wantsReports,
  wantsConfirmations,
  now = new Date(),
}: GetDashboardOverviewInput): Promise<DashboardOverview> {
  if (!wantsReports && !wantsConfirmations) {
    return { metrics: null, topServices: [], monthlyCompletedAppointments: [], pending: [] };
  }

  const salon = await getSalonIdentity(salonId);
  const timezone = salon?.timezone ?? "UTC";
  const monthSequence = getMonthSequence(getMonthStart(now, timezone), timezone);
  const input = { timezone, now };

  const [metricsRow, seriesRows, topServiceRows, pendingRows] = await Promise.all([
    wantsReports ? fetchDashboardMetrics(input) : null,
    wantsReports ? fetchMonthlyAppointmentSeries(input) : null,
    wantsReports ? fetchTopServices(input) : null,
    wantsConfirmations ? findPendingConfirmationRows(salonId, now.toISOString()) : [],
  ]);

  return {
    metrics: metricsRow ? toDashboardMetrics(metricsRow) : null,
    topServices: topServiceRows ?? [],
    monthlyCompletedAppointments: seriesRows ? withMonthLabels(seriesRows, monthSequence) : [],
    pending: mapPendingConfirmations(pendingRows, timezone),
  };
}
