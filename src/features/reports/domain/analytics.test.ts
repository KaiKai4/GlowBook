import { describe, expect, it } from "vitest";
import { calculateHistoricalReportAnalytics } from "./analytics";

const months = [
  { monthKey: "2026-05", label: "may" },
  { monthKey: "2026-06", label: "jun" },
];

const emptyBuckets = {
  appointmentMonths: [],
  busyHours: [],
  retailMonths: [],
  expenseGroups: [],
  purchaseMonths: [],
  productMonths: [],
  inventoryProducts: [],
};

describe("historical report analytics", () => {
  it("combines active revenue and expense modules without duplicating restocks", () => {
    const analytics = calculateHistoricalReportAnalytics({
      ...emptyBuckets,
      months,
      modules: { inventory: true, retail: true, expenses: true },
      appointmentMonths: [{ monthKey: "2026-06", completedRevenue: 100, completedCount: 1 }],
      busyHours: [
        { hour: 15, total: 1 },
        { hour: 16, total: 1 },
      ],
      retailMonths: [{ monthKey: "2026-06", amount: 40 }],
      expenseGroups: [{ monthKey: "2026-06", label: "Alquiler", amount: 25 }],
      purchaseMonths: [{ monthKey: "2026-06", amount: 15 }],
      productMonths: [
        { productId: "product-1", productName: "Aceite", monthKey: "2026-06", quantity: 2 },
      ],
    });

    expect(analytics.months[1]).toMatchObject({
      appointmentRevenue: 100,
      retailRevenue: 40,
      totalRevenue: 140,
      operationalExpenses: 25,
      inventoryPurchases: 15,
      totalExpenses: 40,
      profit: 100,
    });
    expect(analytics.topExpenses).toEqual([
      { label: "Alquiler", amount: 25 },
      { label: "Reposiciones de inventario", amount: 15 },
    ]);
    expect(analytics.productSales[0]).toMatchObject({ name: "Aceite", total: 2, months: [0, 2] });
    expect(analytics.busyHours.map((point) => point.hour)).toEqual([15, 16]);
  });

  it("omits disabled module data from every historical calculation", () => {
    const analytics = calculateHistoricalReportAnalytics({
      ...emptyBuckets,
      months,
      modules: { inventory: false, retail: false, expenses: false },
      appointmentMonths: [{ monthKey: "2026-06", completedRevenue: 80, completedCount: 1 }],
      retailMonths: [{ monthKey: "2026-06", amount: 40 }],
      expenseGroups: [{ monthKey: "2026-06", label: "Alquiler", amount: 25 }],
      purchaseMonths: [{ monthKey: "2026-06", amount: 15 }],
    });

    expect(analytics.months[1]).toMatchObject({
      totalRevenue: 80,
      totalExpenses: 0,
      profit: 80,
    });
    expect(analytics.topExpenses).toEqual([]);
    expect(analytics.inventoryAlerts).toEqual([]);
  });

  it("ignores buckets outside the requested month window", () => {
    const analytics = calculateHistoricalReportAnalytics({
      ...emptyBuckets,
      months,
      modules: { inventory: true, retail: true, expenses: true },
      appointmentMonths: [
        { monthKey: "2026-06", completedRevenue: 100, completedCount: 1 },
        { monthKey: "2026-01", completedRevenue: 999, completedCount: 9 },
      ],
      productMonths: [
        { productId: "product-1", productName: "Aceite", monthKey: "2026-01", quantity: 7 },
      ],
    });

    expect(analytics.months[1].appointmentRevenue).toBe(100);
    expect(analytics.months.every((month) => month.appointmentRevenue <= 100)).toBe(true);
    expect(analytics.productSales).toEqual([]);
  });

  it("adapts stock alerts to the three inventory locations", () => {
    const analytics = calculateHistoricalReportAnalytics({
      ...emptyBuckets,
      months,
      modules: { inventory: true, retail: true, expenses: false },
      inventoryProducts: [
        {
          id: "product-1",
          name: "Shampoo",
          isRetailEnabled: true,
          locations: [
            { location: "retail", quantity: 1, minimumQuantity: 2 },
            { location: "internal", quantity: 0, minimumQuantity: 1 },
            { location: "storage", quantity: 1, minimumQuantity: 2 },
          ],
        },
      ],
    });

    expect(analytics.inventoryAlerts).toEqual([
      {
        id: "product-1",
        name: "Shampoo",
        retail: 1,
        internal: 0,
        storage: 1,
        total: 2,
        minimum: 5,
        state: "bajo",
      },
    ]);
  });
});
