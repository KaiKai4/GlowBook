// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { ExpensesCategoryBreakdown } from "./expenses-category-breakdown";

type CategoryTotal = ExpensesPageView["categoryTotals"][number];

function expensesWith(categoryTotals: CategoryTotal[]): ExpensesPageView {
  return {
    history: [],
    monthTotal: categoryTotals.reduce((sum, total) => sum + total.amount, 0),
    lifetimeTotal: 0,
    categoryTotals,
    topCategory: categoryTotals[0] ?? null,
  };
}

function category(label: string, amount: number): CategoryTotal {
  return { category: label.toLowerCase(), label, amount } as CategoryTotal;
}

describe("ExpensesCategoryBreakdown", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("no pinta nada cuando el mes no tiene gastos por categoría", () => {
    mounted = mountComponent(<ExpensesCategoryBreakdown expenses={expensesWith([])} />);

    expect(mounted.container.textContent).toBe("");
  });

  it("muestra una única categoría al 100% de la barra", () => {
    mounted = mountComponent(<ExpensesCategoryBreakdown expenses={expensesWith([category("Renta", 500)])} />);

    expect(mounted.container.textContent).toContain("Gastos del mes por categoría");
    expect(mounted.container.textContent).toContain("Renta");
    const bar = mounted.container.querySelector<HTMLElement>(".bg-brand-500");
    expect(bar?.style.width).toBe("100%");
  });

  it("escala cada barra respecto a la categoría con mayor gasto y con mínimo visible del 4%", () => {
    mounted = mountComponent(
      <ExpensesCategoryBreakdown
        expenses={expensesWith([category("Renta", 400), category("Productos", 100), category("Otros", 1)])}
      />
    );

    const widths = Array.from(mounted.container.querySelectorAll<HTMLElement>(".bg-brand-500")).map(
      (bar) => bar.style.width
    );
    expect(widths).toEqual(["100%", "25%", "4%"]);
  });

  it("no divide entre cero cuando todas las categorías suman 0 y usa el mínimo visible", () => {
    mounted = mountComponent(
      <ExpensesCategoryBreakdown expenses={expensesWith([category("Renta", 0), category("Luz", 0)])} />
    );

    const widths = Array.from(mounted.container.querySelectorAll<HTMLElement>(".bg-brand-500")).map(
      (bar) => bar.style.width
    );
    expect(widths).toEqual(["4%", "4%"]);
  });
});
