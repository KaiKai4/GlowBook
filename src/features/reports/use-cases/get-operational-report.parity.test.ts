// Paridad JS vs SQL para el reporte operativo del periodo.
//
// El calculo JS que vivia en domain/metrics.ts y domain/commissions.ts se conserva AQUI
// como oraculo: sobre un dataset pequeno, el view model que sale de las funciones SQL
// (report_period_totals, report_operational_breakdown, report_commissions) debe coincidir
// con el que produce el calculo JS anterior. La paridad sobre la base real (y con mas
// de 1000 filas) se verifica en la base de datos; ver needs_db_verification.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCommissionReport,
  fetchOperationalBreakdown,
  fetchPeriodTotals,
} from "../data/rpc/reports-read-models.rpc";
import { findHistoricalReportRows, findSalonReportIdentity, findSalonTimezone } from "../data/reports.repo";
import { getOperationalReport } from "./get-operational-report";

vi.mock("../data/reports.repo", () => ({
  findHistoricalReportRows: vi.fn(),
  findSalonReportIdentity: vi.fn(),
  findSalonTimezone: vi.fn(),
}));

vi.mock("../data/rpc/reports-read-models.rpc", () => ({
  fetchPeriodTotals: vi.fn(),
  fetchOperationalBreakdown: vi.fn(),
  fetchCommissionReport: vi.fn(),
}));

interface OracleAppointment {
  id: string;
  status: string;
  totalPrice: number;
  discountAmount: number;
}

interface OracleItem {
  appointmentId: string;
  price: number;
  serviceId: string | null;
  serviceName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeCommissionPct: number;
}

// Dataset: 4 citas (2 completadas, 1 agendada, 1 no-show) y 3 lineas completadas.
const APPOINTMENTS: OracleAppointment[] = [
  { id: "a1", status: "completed", totalPrice: 115, discountAmount: 5 },
  { id: "a2", status: "completed", totalPrice: 60, discountAmount: 0 },
  { id: "a3", status: "scheduled", totalPrice: 30, discountAmount: 0 },
  { id: "a4", status: "no_show", totalPrice: 40, discountAmount: 0 },
];

const ITEMS: OracleItem[] = [
  {
    appointmentId: "a1",
    price: 95,
    serviceId: "s1",
    serviceName: "Manicura",
    employeeId: "e1",
    employeeName: "Ana Mora",
    employeeCommissionPct: 20,
  },
  {
    appointmentId: "a1",
    price: 20,
    serviceId: "s2",
    serviceName: "Pedicura",
    employeeId: "e2",
    employeeName: "Beto Lopez",
    employeeCommissionPct: 10,
  },
  {
    appointmentId: "a2",
    price: 60,
    serviceId: "s1",
    serviceName: "Manicura",
    employeeId: "e1",
    employeeName: "Ana Mora",
    employeeCommissionPct: 20,
  },
];

const MONEY = { retailRevenue: 25, manualExpenses: 10, inventoryPurchases: 15 };

// --- Oraculo: calculo JS anterior (domain/metrics.ts + domain/commissions.ts) ---

const COMPLETED = "completed";
const STATUS_ORDER = ["completed", "confirmed", "scheduled", "cancelled", "no_show"];

function percentOf(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function oracleStatusBreakdown(appointments: OracleAppointment[]) {
  const counts: Record<string, number> = {};
  for (const appointment of appointments) {
    counts[appointment.status] = (counts[appointment.status] ?? 0) + 1;
  }
  const known = new Set(STATUS_ORDER);
  const unknown = Object.keys(counts).filter((status) => !known.has(status)).sort();
  return [...STATUS_ORDER, ...unknown].flatMap((status) => {
    const count = counts[status];
    return count ? [{ status, count, pct: percentOf(count, appointments.length) }] : [];
  });
}

function oracleEmployeeBreakdown(items: OracleItem[]) {
  const map = new Map<string, { name: string; appointmentIds: Set<string>; revenue: number }>();
  for (const item of items) {
    if (!item.employeeId || !item.employeeName) continue;
    const entry = map.get(item.employeeId) ?? {
      name: item.employeeName,
      appointmentIds: new Set<string>(),
      revenue: 0,
    };
    entry.appointmentIds.add(item.appointmentId);
    entry.revenue += item.price;
    map.set(item.employeeId, entry);
  }
  const list = [...map.values()]
    .map((entry) => ({ name: entry.name, count: entry.appointmentIds.size, revenue: entry.revenue }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  const max = list[0]?.revenue ?? 0;
  return list.map((entry) => ({ ...entry, pct: percentOf(entry.revenue, max) }));
}

function oracleServiceBreakdown(items: OracleItem[]) {
  const map = new Map<string, { name: string; count: number; revenue: number }>();
  for (const item of items) {
    if (!item.serviceId || !item.serviceName) continue;
    const entry = map.get(item.serviceId) ?? { name: item.serviceName, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += item.price;
    map.set(item.serviceId, entry);
  }
  const list = [...map.values()].sort(
    (a, b) => b.count - a.count || b.revenue - a.revenue || a.name.localeCompare(b.name)
  );
  const max = list[0]?.count ?? 0;
  return list.map((entry) => ({ ...entry, pct: percentOf(entry.count, max) }));
}

function oracleCommissions(items: OracleItem[]) {
  const map = new Map<
    string,
    { name: string; appointmentIds: Set<string>; revenue: number; commissionPct: number }
  >();
  for (const item of items) {
    if (!item.employeeId || !item.employeeName) continue;
    const entry = map.get(item.employeeId) ?? {
      name: item.employeeName,
      appointmentIds: new Set<string>(),
      revenue: 0,
      commissionPct: item.employeeCommissionPct,
    };
    entry.appointmentIds.add(item.appointmentId);
    entry.revenue += item.price;
    entry.commissionPct = item.employeeCommissionPct;
    map.set(item.employeeId, entry);
  }
  const rows = [...map.entries()]
    .map(([employeeId, entry]) => {
      const revenue = round2(entry.revenue);
      return {
        employeeId,
        name: entry.name,
        appointments: entry.appointmentIds.size,
        revenue,
        commissionPct: entry.commissionPct,
        commission: round2((revenue * entry.commissionPct) / 100),
      };
    })
    .sort((a, b) => b.commission - a.commission || b.revenue - a.revenue || a.name.localeCompare(b.name));
  return {
    rows,
    totalRevenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)),
    totalCommission: round2(rows.reduce((sum, row) => sum + row.commission, 0)),
  };
}

function oracleMetrics() {
  const completed = APPOINTMENTS.filter((appointment) => appointment.status === COMPLETED);
  const revenue = completed.reduce((sum, appointment) => sum + appointment.totalPrice, 0);
  const discounts = completed.reduce((sum, appointment) => sum + appointment.discountAmount, 0);
  const grossRevenue = revenue + MONEY.retailRevenue;
  const totalExpenses = MONEY.manualExpenses + MONEY.inventoryPurchases;
  const noShows = APPOINTMENTS.filter((appointment) => appointment.status === "no_show").length;
  return {
    revenue,
    discounts,
    retailRevenue: MONEY.retailRevenue,
    grossRevenue,
    manualExpenses: MONEY.manualExpenses,
    inventoryPurchases: MONEY.inventoryPurchases,
    totalExpenses,
    estimatedProfit: grossRevenue - totalExpenses,
    completedCount: completed.length,
    totalCount: APPOINTMENTS.length,
    avgTicket: revenue / completed.length,
    noShowRate: percentOf(noShows, APPOINTMENTS.length),
    statusBreakdown: oracleStatusBreakdown(APPOINTMENTS),
    byEmployee: oracleEmployeeBreakdown(ITEMS),
    byService: oracleServiceBreakdown(ITEMS),
    commissions: oracleCommissions(ITEMS),
  };
}

// --- Payloads SQL: lo que devuelven report_period_totals / _operational_breakdown / _commissions ---
// Derivados a mano del mismo dataset (las funciones SQL redondean y ordenan igual que el oraculo).

const SQL_TOTALS = {
  revenue: 175,
  discounts: 5,
  retailRevenue: 25,
  grossRevenue: 200,
  manualExpenses: 10,
  inventoryPurchases: 15,
  totalExpenses: 25,
  estimatedProfit: 175,
  completedCount: 2,
  totalCount: 4,
  avgTicket: 87.5,
  noShowRate: 25,
  newCustomers: 2,
};

const SQL_BREAKDOWN = {
  statusBreakdown: [
    { status: "completed", count: 2, pct: 50 },
    { status: "scheduled", count: 1, pct: 25 },
    { status: "no_show", count: 1, pct: 25 },
  ],
  byEmployee: [
    { name: "Ana Mora", count: 2, revenue: 155, pct: 100 },
    { name: "Beto Lopez", count: 1, revenue: 20, pct: percentOf(20, 155) },
  ],
  byService: [
    { name: "Manicura", count: 2, revenue: 155, pct: 100 },
    { name: "Pedicura", count: 1, revenue: 20, pct: 50 },
  ],
};

const SQL_COMMISSIONS = {
  rows: [
    { employeeId: "e1", name: "Ana Mora", appointments: 2, revenue: 155, commissionPct: 20, commission: 31 },
    { employeeId: "e2", name: "Beto Lopez", appointments: 1, revenue: 20, commissionPct: 10, commission: 2 },
  ],
  totalRevenue: 175,
  totalCommission: 33,
};

const mockedTotals = vi.mocked(fetchPeriodTotals);
const mockedBreakdown = vi.mocked(fetchOperationalBreakdown);
const mockedCommissions = vi.mocked(fetchCommissionReport);

function roundPct<T extends { pct: number }>(rows: T[]): Array<Omit<T, "pct"> & { pct: number }> {
  return rows.map((row) => ({ ...row, pct: Math.round(row.pct * 1e6) / 1e6 }));
}

describe("paridad JS vs SQL del reporte operativo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(findSalonTimezone).mockResolvedValue("UTC");
    vi.mocked(findSalonReportIdentity).mockResolvedValue({
      name: "Glow Studio",
      timezone: "UTC",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(findHistoricalReportRows).mockResolvedValue({
      appointmentMonths: [],
      busyHours: [],
      retailMonths: [],
      expenseGroups: [],
      purchaseMonths: [],
      productMonths: [],
      inventoryProducts: [],
    });
    mockedTotals.mockResolvedValue(SQL_TOTALS);
    mockedBreakdown.mockResolvedValue(SQL_BREAKDOWN);
    mockedCommissions.mockResolvedValue(SQL_COMMISSIONS);
  });

  it("el view model de SQL coincide con el oraculo JS en cifras, desgloses y comisiones", async () => {
    const report = await getOperationalReport({
      salonId: "salon-1",
      filters: { preset: "mes", from: "2026-06-01", to: "2026-06-30" },
      now: new Date("2026-06-15T12:00:00.000Z"),
    });
    const oracle = oracleMetrics();

    expect({
      revenue: report.revenue,
      discounts: report.discounts,
      retailRevenue: report.retailRevenue,
      grossRevenue: report.grossRevenue,
      manualExpenses: report.manualExpenses,
      inventoryPurchases: report.inventoryPurchases,
      totalExpenses: report.totalExpenses,
      estimatedProfit: report.estimatedProfit,
      completedCount: report.completedCount,
      totalCount: report.totalCount,
      avgTicket: report.avgTicket,
      noShowRate: report.noShowRate,
    }).toEqual({
      revenue: oracle.revenue,
      discounts: oracle.discounts,
      retailRevenue: oracle.retailRevenue,
      grossRevenue: oracle.grossRevenue,
      manualExpenses: oracle.manualExpenses,
      inventoryPurchases: oracle.inventoryPurchases,
      totalExpenses: oracle.totalExpenses,
      estimatedProfit: oracle.estimatedProfit,
      completedCount: oracle.completedCount,
      totalCount: oracle.totalCount,
      avgTicket: oracle.avgTicket,
      noShowRate: oracle.noShowRate,
    });
    expect(report.statusBreakdown).toEqual(oracle.statusBreakdown);
    expect(roundPct(report.byEmployee.map(({ name, count, revenue, pct }) => ({ name, count, revenue, pct })))).toEqual(
      roundPct(oracle.byEmployee)
    );
    expect(roundPct(report.byService.map(({ name, count, revenue, pct }) => ({ name, count, revenue, pct })))).toEqual(
      roundPct(oracle.byService)
    );
    expect(report.commissions).toEqual(oracle.commissions);
    expect(report.newCustomers).toBe(2);
  });
});
