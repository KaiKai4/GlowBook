import { describe, expect, it } from "vitest";
import { calculateHistoricalReportAnalytics } from "./analytics";

const months = [
  { monthKey: "2026-05", label: "may" },
  { monthKey: "2026-06", label: "jun" },
];

describe("historical report analytics", () => {
  it("combines active revenue and expense modules without duplicating restocks", () => {
    const analytics = calculateHistoricalReportAnalytics({
      timezone: "UTC",
      months,
      modules: { inventory: true, retail: true, expenses: true },
      appointments: [
        { status: "completed", totalPrice: 100, startTime: "2026-06-05T15:00:00.000Z" },
        { status: "cancelled", totalPrice: 50, startTime: "2026-06-05T16:00:00.000Z" },
      ],
      retailSales: [{ date: "2026-06-06T15:00:00.000Z", amount: 40 }],
      expenses: [{ date: "2026-06-02", amount: 25, label: "Alquiler" }],
      inventoryPurchases: [{ date: "2026-06-03", amount: 15 }],
      retailItems: [
        {
          date: "2026-06-06T15:00:00.000Z",
          productId: "product-1",
          productName: "Aceite",
          quantity: 2,
        },
      ],
      inventoryProducts: [],
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
  });

  it("omits disabled module data from every historical calculation", () => {
    const analytics = calculateHistoricalReportAnalytics({
      timezone: "UTC",
      months,
      modules: { inventory: false, retail: false, expenses: false },
      appointments: [
        { status: "completed", totalPrice: 80, startTime: "2026-06-05T15:00:00.000Z" },
      ],
      retailSales: [{ date: "2026-06-06T15:00:00.000Z", amount: 40 }],
      expenses: [{ date: "2026-06-02", amount: 25, label: "Alquiler" }],
      inventoryPurchases: [{ date: "2026-06-03", amount: 15 }],
      retailItems: [],
      inventoryProducts: [],
    });

    expect(analytics.months[1]).toMatchObject({
      totalRevenue: 80,
      totalExpenses: 0,
      profit: 80,
    });
    expect(analytics.topExpenses).toEqual([]);
    expect(analytics.inventoryAlerts).toEqual([]);
  });

  it("adapts stock alerts to the three inventory locations", () => {
    const analytics = calculateHistoricalReportAnalytics({
      timezone: "UTC",
      months,
      modules: { inventory: true, retail: true, expenses: false },
      appointments: [],
      retailSales: [],
      expenses: [],
      inventoryPurchases: [],
      retailItems: [],
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
