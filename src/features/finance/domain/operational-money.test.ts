import { describe, expect, it } from "vitest";
import { calculateOperationalMoneyTotals } from "./operational-money";

describe("operational money totals", () => {
  it("calculates salon revenue, expenses and estimated profit from operating sources", () => {
    expect(
      calculateOperationalMoneyTotals({
        appointmentRevenue: 120,
        retailRevenue: 35,
        manualExpenses: 20,
        inventoryPurchases: 45,
      })
    ).toEqual({
      appointmentRevenue: 120,
      retailRevenue: 35,
      manualExpenses: 20,
      inventoryPurchases: 45,
      grossRevenue: 155,
      totalExpenses: 65,
      estimatedProfit: 90,
    });
  });
});
