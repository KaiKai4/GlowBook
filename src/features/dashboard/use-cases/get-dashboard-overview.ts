import "server-only";

import { getUtcDayBoundaries, formatLocalDateISO } from "@/lib/utils/dates";
import { calculateOperationalMoneyTotals } from "@/features/finance/domain/operational-money";
import { getExternalOperationalMoney } from "@/features/finance/use-cases/operational-money";
import { getLowStockSummary } from "@/features/inventory/use-cases/low-stock-summary";
import { findSalonIdentity } from "@/features/salon/data/salon.repo";
import {
  findDashboardReportRows,
  findPendingConfirmationRows,
  type DashboardBookedServiceRow,
  type DashboardPendingConfirmationRow,
} from "../data/dashboard.repo";

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

export interface DashboardMetrics {
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

function calculateTopServices(rows: DashboardBookedServiceRow[]): TopService[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const status = firstRelation(row.appointment)?.status;
    if (status === "cancelled" || status === "no_show") continue;

    const name = firstRelation(row.service)?.name;
    if (!name) continue;

    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted[0]?.[1] ?? 0;

  return sorted.map(([name, count]) => ({
    name,
    count,
    pct: max ? (count / max) * 100 : 0,
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
    return { metrics: null, topServices: [], pending: [] };
  }

  const salon = await findSalonIdentity(salonId);
  const timezone = salon?.timezone ?? "UTC";
  const { start: todayStart, end: todayEnd } = getUtcDayBoundaries(now, timezone);
  const monthStart = getMonthStart(now, timezone);
  const todayLocal = formatLocalDateISO(now, timezone);
  const monthStartLocal = formatLocalDateISO(monthStart, timezone);

  const [reportRows, pendingRows, externalMoney, lowStockSummary] = await Promise.all([
    wantsReports
      ? findDashboardReportRows({
          salonId,
          todayStart: todayStart.toISOString(),
          todayEnd: todayEnd.toISOString(),
          monthStart: monthStart.toISOString(),
        })
      : null,
    wantsConfirmations ? findPendingConfirmationRows(salonId, now.toISOString()) : [],
    wantsReports
      ? getExternalOperationalMoney({
          salonId,
          fromIso: monthStart.toISOString(),
          toIso: now.toISOString(),
          fromDate: monthStartLocal,
          toDate: todayLocal,
        })
      : null,
    wantsReports ? getLowStockSummary(salonId) : null,
  ]);

  const metrics = reportRows
    ? (() => {
        const appointmentRevenue = reportRows.monthAppointments.reduce(
          (sum, appointment) => sum + Number(appointment.total_price ?? 0),
          0
        );
        const money = calculateOperationalMoneyTotals({
          appointmentRevenue,
          retailRevenue: externalMoney?.retailRevenue ?? 0,
          manualExpenses: externalMoney?.manualExpenses ?? 0,
          inventoryPurchases: externalMoney?.inventoryPurchases ?? 0,
        });

        return {
        todayAppointments: reportRows.todayAppointments,
        appointmentRevenue: money.appointmentRevenue,
        retailRevenue: money.retailRevenue,
        monthRevenue: money.grossRevenue,
        monthExpenses: money.totalExpenses,
        estimatedProfit: money.estimatedProfit,
        lowStockProducts: lowStockSummary?.productCount ?? 0,
        totalCustomers: reportRows.totalCustomers,
        completedThisMonth: reportRows.monthAppointments.length,
      };
    })()
    : null;

  return {
    metrics,
    topServices: reportRows ? calculateTopServices(reportRows.bookedServices) : [],
    pending: mapPendingConfirmations(pendingRows, timezone),
  };
}
