import { describe, expect, it } from "vitest";
import { calculateOperationalReportMetrics, type ReportAppointmentItem } from "./metrics";

// La columna de precio puede llegar nula desde la base: el agregado la trata como 0.
function itemWithoutPrice(overrides: Partial<ReportAppointmentItem>): ReportAppointmentItem {
  return {
    appointmentId: "a1",
    price: undefined as unknown as number,
    serviceId: null,
    serviceName: null,
    employeeId: null,
    employeeName: null,
    employeeCommissionPct: 0,
    ...overrides,
  };
}

describe("metricas operativas con precio nulo", () => {
  it("un empleado con precio nulo cuenta la cita pero suma 0 de ingreso", () => {
    const metrics = calculateOperationalReportMetrics(
      [],
      [itemWithoutPrice({ employeeId: "e1", employeeName: "Ana Vega" })]
    );

    expect(metrics.byEmployee).toEqual([{ name: "Ana Vega", count: 1, revenue: 0, pct: 0 }]);
  });

  it("un servicio con precio nulo cuenta la aparición pero suma 0 de ingreso", () => {
    const metrics = calculateOperationalReportMetrics(
      [],
      [itemWithoutPrice({ serviceId: "s1", serviceName: "Corte" })]
    );

    expect(metrics.byService).toEqual([{ name: "Corte", count: 1, revenue: 0, pct: 100 }]);
  });
});
