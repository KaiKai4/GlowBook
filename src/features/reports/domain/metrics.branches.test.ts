import { describe, expect, it } from "vitest";
import {
  calculateOperationalReportMetrics,
  type ReportAppointment,
  type ReportAppointmentItem,
} from "./metrics";

function appointment(id: string, status: string, totalPrice = 0, discountAmount = 0): ReportAppointment {
  return { id, status, totalPrice, discountAmount };
}

function item(overrides: Partial<ReportAppointmentItem>): ReportAppointmentItem {
  return {
    appointmentId: "a1",
    price: 0,
    serviceId: null,
    serviceName: null,
    employeeId: null,
    employeeName: null,
    employeeCommissionPct: 0,
    ...overrides,
  };
}

describe("metricas operativas (ramas)", () => {
  it("devuelve ceros y listas vacias sin citas", () => {
    const metrics = calculateOperationalReportMetrics([], []);

    expect(metrics).toMatchObject({
      revenue: 0,
      discounts: 0,
      completedCount: 0,
      totalCount: 0,
      avgTicket: 0,
      noShowRate: 0,
      statusBreakdown: [],
      byEmployee: [],
      byService: [],
    });
  });

  it("calcula ingresos, descuentos y ticket promedio solo con citas completadas", () => {
    const metrics = calculateOperationalReportMetrics(
      [
        appointment("a1", "completed", 100, 10),
        appointment("a2", "completed", 50, 0),
        appointment("a3", "cancelled", 999, 5),
      ],
      []
    );

    expect(metrics.revenue).toBe(150);
    expect(metrics.discounts).toBe(10);
    expect(metrics.completedCount).toBe(2);
    expect(metrics.totalCount).toBe(3);
    expect(metrics.avgTicket).toBe(75);
    expect(metrics.grossRevenue).toBe(150);
    expect(metrics.estimatedProfit).toBe(150);
  });

  it("calcula la tasa de no asistencia sobre el total de citas", () => {
    const metrics = calculateOperationalReportMetrics(
      [appointment("a1", "no_show"), appointment("a2", "completed", 10), appointment("a3", "scheduled"), appointment("a4", "no_show")],
      []
    );

    expect(metrics.noShowRate).toBe(50);
  });

  it("ordena el desglose por estado segun el orden conocido y deja los desconocidos al final, ordenados", () => {
    const metrics = calculateOperationalReportMetrics(
      [
        appointment("1", "zeta"),
        appointment("2", "cancelled"),
        appointment("3", "alfa"),
        appointment("4", "completed"),
        appointment("5", "completed"),
      ],
      []
    );

    expect(metrics.statusBreakdown.map((entry) => [entry.status, entry.count])).toEqual([
      ["completed", 2],
      ["cancelled", 1],
      ["alfa", 1],
      ["zeta", 1],
    ]);
    expect(metrics.statusBreakdown[0]?.pct).toBe(40);
  });

  it("agrupa por colaborador contando citas distintas y omite lineas sin colaborador identificable", () => {
    const metrics = calculateOperationalReportMetrics(
      [appointment("a1", "completed", 80), appointment("a2", "completed", 40)],
      [
        item({ appointmentId: "a1", price: 50, employeeId: "e1", employeeName: "Ana Vega" }),
        item({ appointmentId: "a1", price: 30, employeeId: "e1", employeeName: "Ana Vega" }),
        item({ appointmentId: "a2", price: 40, employeeId: "e2", employeeName: "Beto Luna" }),
        item({ appointmentId: "a2", price: 99, employeeId: null, employeeName: "Fantasma" }),
        item({ appointmentId: "a2", price: 99, employeeId: "e3", employeeName: null }),
      ]
    );

    expect(metrics.byEmployee).toEqual([
      { name: "Ana Vega", count: 1, revenue: 80, pct: 100 },
      { name: "Beto Luna", count: 1, revenue: 40, pct: 50 },
    ]);
  });

  it("desempata colaboradores por nombre cuando el ingreso es igual", () => {
    const metrics = calculateOperationalReportMetrics(
      [],
      [
        item({ appointmentId: "a1", price: 20, employeeId: "e2", employeeName: "Zoe" }),
        item({ appointmentId: "a1", price: 20, employeeId: "e1", employeeName: "Ana" }),
      ]
    );

    expect(metrics.byEmployee.map((employee) => employee.name)).toEqual(["Ana", "Zoe"]);
  });

  it("agrupa servicios por cantidad, luego por ingreso y luego por nombre, ignorando lineas sin servicio", () => {
    const metrics = calculateOperationalReportMetrics(
      [],
      [
        item({ serviceId: "s1", serviceName: "Corte", price: 10 }),
        item({ serviceId: "s1", serviceName: "Corte", price: 10 }),
        item({ serviceId: "s2", serviceName: "Lavado", price: 50 }),
        item({ serviceId: "s3", serviceName: "Cejas", price: 20 }),
        item({ serviceId: "s4", serviceName: "Barba", price: 20 }),
        item({ serviceId: null, serviceName: "Sin id", price: 500 }),
        item({ serviceId: "s5", serviceName: null, price: 500 }),
      ]
    );

    expect(metrics.byService.map((service) => [service.name, service.count, service.revenue])).toEqual([
      ["Corte", 2, 20],
      ["Lavado", 1, 50],
      ["Barba", 1, 20],
      ["Cejas", 1, 20],
    ]);
    expect(metrics.byService[0]?.pct).toBe(100);
    expect(metrics.byService[2]?.pct).toBe(50);
  });

  it("incluye el desglose de comisiones calculado a partir de las lineas", () => {
    const metrics = calculateOperationalReportMetrics(
      [appointment("a1", "completed", 100)],
      [item({ appointmentId: "a1", price: 100, employeeId: "e1", employeeName: "Ana", employeeCommissionPct: 40 })]
    );

    expect(metrics.commissions).toBeDefined();
    expect(metrics.commissions).toEqual(expect.any(Object));
  });
});
