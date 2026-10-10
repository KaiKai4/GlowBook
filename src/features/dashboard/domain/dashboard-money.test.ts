import { describe, expect, it } from "vitest";
import { selectDashboardMoney, type DashboardMoneyFigures } from "./dashboard-money";

// Filas como las devuelve report_dashboard_metrics (sin redondeo adicional).
const WITH_DECIMALS: DashboardMoneyFigures = {
  appointmentRevenue: 35.5,
  retailRevenue: 12.25,
  monthRevenue: 47.75,
  monthExpenses: 12.5,
  estimatedProfit: 35.25,
};

const NEGATIVE_PROFIT: DashboardMoneyFigures = {
  appointmentRevenue: 10,
  retailRevenue: 0,
  monthRevenue: 10,
  monthExpenses: 25,
  estimatedProfit: -15,
};

describe("selectDashboardMoney", () => {
  it("usa el beneficio de la base cuando retail y gastos están activos", () => {
    expect(selectDashboardMoney(WITH_DECIMALS, { includeRetail: true, includeExpenses: true })).toEqual({
      revenue: 47.75,
      profit: 35.25,
    });
  });

  it("conserva el beneficio negativo calculado por la base", () => {
    expect(selectDashboardMoney(NEGATIVE_PROFIT, { includeRetail: true, includeExpenses: true })).toEqual({
      revenue: 10,
      profit: -15,
    });
  });

  it("sin gastos el beneficio es el ingreso visible (citas mas retail)", () => {
    expect(selectDashboardMoney(WITH_DECIMALS, { includeRetail: true, includeExpenses: false })).toEqual({
      revenue: 47.75,
      profit: 47.75,
    });
  });

  it("sin retail el ingreso son solo las citas y el beneficio descuenta los gastos", () => {
    expect(selectDashboardMoney(WITH_DECIMALS, { includeRetail: false, includeExpenses: true })).toEqual({
      revenue: 35.5,
      profit: 23,
    });
    expect(selectDashboardMoney(NEGATIVE_PROFIT, { includeRetail: false, includeExpenses: true })).toEqual({
      revenue: 10,
      profit: -15,
    });
  });

  it("sin retail ni gastos el beneficio coincide con las citas", () => {
    expect(selectDashboardMoney(WITH_DECIMALS, { includeRetail: false, includeExpenses: false })).toEqual({
      revenue: 35.5,
      profit: 35.5,
    });
  });
});
