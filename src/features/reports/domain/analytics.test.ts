import { describe, expect, it } from "vitest";
import { busyHourLabel, trimMonthlyRows, type MonthlyExportRow } from "./analytics";

function row(monthKey: string, overrides: Partial<MonthlyExportRow> = {}): MonthlyExportRow {
  return {
    monthKey,
    completedAppointments: 0,
    appointmentRevenue: 0,
    retailRevenue: 0,
    grossRevenue: 0,
    operationalExpenses: 0,
    inventoryPurchases: 0,
    totalExpenses: 0,
    profit: 0,
    ...overrides,
  };
}

describe("busyHourLabel", () => {
  it("formatea la hora en 12 horas en espanol", () => {
    expect(busyHourLabel(10)).toMatch(/10/);
    expect(busyHourLabel(15)).toMatch(/3/);
  });
});

describe("trimMonthlyRows", () => {
  it("devuelve lista vacia cuando ningun mes tiene movimientos", () => {
    const rows = [row("2026-01"), row("2026-02")];

    expect(trimMonthlyRows(rows, "2026-02")).toEqual([]);
  });

  it("considera movimiento una cita completada, un ingreso o un gasto distinto de cero", () => {
    const rows = [
      row("2026-01", { completedAppointments: 1 }),
      row("2026-02", { grossRevenue: 5 }),
      row("2026-03", { totalExpenses: 5 }),
      row("2026-04"),
    ];

    expect(trimMonthlyRows(rows, "2026-04").map((r) => r.monthKey)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("recorta los meses en cero antes del primer movimiento y después del mes actual", () => {
    const rows = [
      row("2026-01"),
      row("2026-02", { completedAppointments: 2, grossRevenue: 100 }),
      row("2026-03"),
      row("2026-04", { totalExpenses: 40 }),
      row("2026-05"),
      row("2026-06"),
    ];

    expect(trimMonthlyRows(rows, "2026-03").map((r) => r.monthKey)).toEqual(["2026-02", "2026-03", "2026-04"]);
  });

  it("conserva el mes actual aunque no tenga movimientos al final de la serie", () => {
    const rows = [row("2026-01", { completedAppointments: 1 }), row("2026-02"), row("2026-03")];

    expect(trimMonthlyRows(rows, "2026-03").map((r) => r.monthKey)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("no recorta movimientos posteriores al mes actual", () => {
    const rows = [row("2026-01", { completedAppointments: 1 }), row("2026-02", { completedAppointments: 1 })];

    expect(trimMonthlyRows(rows, "2026-01").map((r) => r.monthKey)).toEqual(["2026-01", "2026-02"]);
  });
});
