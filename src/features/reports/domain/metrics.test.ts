import { describe, expect, it } from "vitest";
import {
  calculateOperationalReportMetrics,
  type ReportAppointment,
  type ReportAppointmentItem,
} from "./metrics";

const appointments: ReportAppointment[] = [
  { id: "appt-1", status: "completed", totalPrice: 45, discountAmount: 5 },
  { id: "appt-2", status: "completed", totalPrice: 30, discountAmount: 0 },
  { id: "appt-3", status: "no_show", totalPrice: 0, discountAmount: 0 },
  { id: "appt-4", status: "scheduled", totalPrice: 25, discountAmount: 0 },
];

const items: ReportAppointmentItem[] = [
  {
    appointmentId: "appt-1",
    price: 30,
    serviceId: "svc-1",
    serviceName: "Corte",
    employeeId: "emp-1",
    employeeName: "Ana Lopez",
    employeeCommissionPct: 0,
  },
  {
    appointmentId: "appt-1",
    price: 20,
    serviceId: "svc-2",
    serviceName: "Barba",
    employeeId: "emp-1",
    employeeName: "Ana Lopez",
    employeeCommissionPct: 0,
  },
  {
    appointmentId: "appt-2",
    price: 30,
    serviceId: "svc-1",
    serviceName: "Corte",
    employeeId: "emp-2",
    employeeName: "Luis Vega",
    employeeCommissionPct: 0,
  },
];

describe("report metrics", () => {
  it("calculates revenue, average ticket and no-show rate from appointments", () => {
    const metrics = calculateOperationalReportMetrics(appointments, items);

    expect(metrics.revenue).toBe(75);
    expect(metrics.discounts).toBe(5);
    expect(metrics.completedCount).toBe(2);
    expect(metrics.totalCount).toBe(4);
    expect(metrics.avgTicket).toBe(37.5);
    expect(metrics.noShowRate).toBe(25);
  });

  it("keeps status breakdown ordered and percent-based", () => {
    expect(calculateOperationalReportMetrics(appointments, items).statusBreakdown).toEqual([
      { status: "completed", count: 2, pct: 50 },
      { status: "scheduled", count: 1, pct: 25 },
      { status: "no_show", count: 1, pct: 25 },
    ]);
  });

  it("counts unique appointments per collaborator and ranks by revenue", () => {
    expect(calculateOperationalReportMetrics(appointments, items).byEmployee).toEqual([
      { name: "Ana Lopez", count: 1, revenue: 50, pct: 100 },
      { name: "Luis Vega", count: 1, revenue: 30, pct: 60 },
    ]);
  });

  it("counts services by item volume and keeps revenue attached", () => {
    expect(calculateOperationalReportMetrics(appointments, items).byService).toEqual([
      { name: "Corte", count: 2, revenue: 60, pct: 100 },
      { name: "Barba", count: 1, revenue: 20, pct: 50 },
    ]);
  });

  it("returns zeroed metrics for empty periods", () => {
    expect(calculateOperationalReportMetrics([], [])).toEqual({
      revenue: 0,
      retailRevenue: 0,
      grossRevenue: 0,
      discounts: 0,
      manualExpenses: 0,
      inventoryPurchases: 0,
      totalExpenses: 0,
      estimatedProfit: 0,
      completedCount: 0,
      totalCount: 0,
      avgTicket: 0,
      noShowRate: 0,
      statusBreakdown: [],
      byEmployee: [],
      byService: [],
      commissions: { rows: [], totalRevenue: 0, totalCommission: 0 },
    });
  });
});
