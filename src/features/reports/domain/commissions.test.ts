import { describe, expect, it } from "vitest";
import { calculateCommissionReport } from "./commissions";
import type { ReportAppointmentItem } from "./metrics";

function item(partial: Partial<ReportAppointmentItem>): ReportAppointmentItem {
  return {
    appointmentId: "a1",
    price: 0,
    serviceId: "s1",
    serviceName: "Corte",
    employeeId: "e1",
    employeeName: "Ana Mora",
    employeeCommissionPct: 0,
    ...partial,
  };
}

describe("commission report", () => {
  it("computes commission as revenue times percentage per employee", () => {
    const report = calculateCommissionReport([
      item({ appointmentId: "a1", employeeId: "e1", employeeName: "Ana", price: 100, employeeCommissionPct: 20 }),
      item({ appointmentId: "a1", employeeId: "e1", employeeName: "Ana", price: 50, employeeCommissionPct: 20 }),
      item({ appointmentId: "a2", employeeId: "e2", employeeName: "Beto", price: 200, employeeCommissionPct: 10 }),
    ]);

    expect(report.rows).toEqual([
      { employeeId: "e1", name: "Ana", appointments: 1, revenue: 150, commissionPct: 20, commission: 30 },
      { employeeId: "e2", name: "Beto", appointments: 1, revenue: 200, commissionPct: 10, commission: 20 },
    ]);
    expect(report.totalRevenue).toBe(350);
    expect(report.totalCommission).toBe(50);
  });

  it("counts distinct appointments, not items", () => {
    const report = calculateCommissionReport([
      item({ appointmentId: "a1", price: 40, employeeCommissionPct: 50 }),
      item({ appointmentId: "a1", price: 60, employeeCommissionPct: 50 }),
      item({ appointmentId: "a2", price: 100, employeeCommissionPct: 50 }),
    ]);

    expect(report.rows[0]).toMatchObject({ appointments: 2, revenue: 200, commission: 100 });
  });

  it("includes zero-commission employees with commission 0", () => {
    const report = calculateCommissionReport([
      item({ employeeId: "e1", employeeName: "Ana", price: 100, employeeCommissionPct: 0 }),
    ]);

    expect(report.rows[0]).toMatchObject({ revenue: 100, commissionPct: 0, commission: 0 });
    expect(report.totalCommission).toBe(0);
  });

  it("ignores items without an employee", () => {
    const report = calculateCommissionReport([
      item({ employeeId: null, employeeName: null, price: 100 }),
    ]);

    expect(report.rows).toEqual([]);
  });
});
