import { describe, expect, it } from "vitest";
import { toLifetimeTotals, type PeriodTotalsSource } from "./analytics";
import { lastDayOfMonth } from "./period";

const TOTALS: PeriodTotalsSource = {
  revenue: 100,
  retailRevenue: 20,
  grossRevenue: 120,
  manualExpenses: 30,
  inventoryPurchases: 10,
  totalExpenses: 40,
  estimatedProfit: 80,
  completedCount: 7,
};

describe("lastDayOfMonth", () => {
  it("devuelve el último día de meses de 30, 31 y 28 días", () => {
    expect(lastDayOfMonth("2026-04")).toBe("2026-04-30");
    expect(lastDayOfMonth("2026-01")).toBe("2026-01-31");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  });

  it("considera años bisiestos", () => {
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29");
  });
});

describe("toLifetimeTotals", () => {
  it("renombra los totales de período a la forma del acumulado", () => {
    expect(toLifetimeTotals(TOTALS)).toEqual({
      appointmentRevenue: 100,
      retailRevenue: 20,
      grossRevenue: 120,
      operationalExpenses: 30,
      inventoryPurchases: 10,
      totalExpenses: 40,
      estimatedProfit: 80,
      completedAppointments: 7,
    });
  });
});
