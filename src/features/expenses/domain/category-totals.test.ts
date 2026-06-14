import { describe, expect, it } from "vitest";
import { aggregateByCategory, topCategory } from "./category-totals";

describe("expense category totals", () => {
  it("groups by category and sorts by amount desc", () => {
    const totals = aggregateByCategory([
      { category: "rent", customCategory: null, amount: 500 },
      { category: "products", customCategory: null, amount: 120 },
      { category: "rent", customCategory: null, amount: 100 },
      { category: "marketing", customCategory: null, amount: 300 },
    ]);

    expect(totals.map((total) => [total.label, total.amount])).toEqual([
      ["Alquiler", 600],
      ["Publicidad y marketing", 300],
      ["Productos e insumos", 120],
    ]);
  });

  it("breaks down 'other' by its free-text label", () => {
    const totals = aggregateByCategory([
      { category: "other", customCategory: "Donación", amount: 50 },
      { category: "other", customCategory: "Donación", amount: 25 },
      { category: "other", customCategory: "Multa", amount: 40 },
      { category: "other", customCategory: null, amount: 10 },
    ]);

    expect(totals).toEqual([
      { category: "other", label: "Donación", amount: 75 },
      { category: "other", label: "Multa", amount: 40 },
      { category: "other", label: "Otro", amount: 10 },
    ]);
  });

  it("reports the top category or null", () => {
    expect(topCategory([])).toBeNull();
    expect(
      topCategory(
        aggregateByCategory([
          { category: "rent", customCategory: null, amount: 500 },
          { category: "products", customCategory: null, amount: 120 },
        ])
      )
    ).toMatchObject({ label: "Alquiler", amount: 500 });
  });
});
