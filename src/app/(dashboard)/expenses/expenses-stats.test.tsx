// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { ExpensesStats } from "./expenses-stats";

function view(overrides: Partial<ExpensesPageView>): ExpensesPageView {
  return {
    history: [],
    monthTotal: 0,
    lifetimeTotal: 0,
    categoryTotals: [],
    topCategory: null,
    ...overrides,
  };
}

function metricValue(container: HTMLElement, label: string): string | null {
  const labelNode = Array.from(container.querySelectorAll("p")).find((node) => node.textContent === label);
  return labelNode?.nextElementSibling?.textContent ?? null;
}

describe("ExpensesStats", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra los totales del mes y el histórico en dólares formateados", () => {
    mounted = mountComponent(
      <ExpensesStats expenses={view({ monthTotal: 1250.5, lifetimeTotal: 9800, history: [] })} />
    );

    // El separador decimal depende del locale es-PA de Intl: se comprueban los dígitos.
    expect(metricValue(mounted.container, "Egresos este mes")).toMatch(/1.?250[.,]50/);
    expect(metricValue(mounted.container, "Egresos históricos")).toMatch(/9.?800[.,]00/);
    expect(metricValue(mounted.container, "Movimientos (histórico)")).toBe("0");
  });

  it("sin gastos del mes muestra guion y la pista de 'Sin gastos este mes'", () => {
    mounted = mountComponent(<ExpensesStats expenses={view({ topCategory: null })} />);

    expect(metricValue(mounted.container, "Mayor gasto del mes")).toBe("—");
    expect(mounted.container.textContent).toContain("Sin gastos este mes");
  });

  it("con categoría dominante muestra su importe y su etiqueta como pista", () => {
    mounted = mountComponent(
      <ExpensesStats
        expenses={view({
          topCategory: { category: "rent", label: "Alquiler", amount: 800 },
          monthTotal: 1000,
        })}
      />
    );

    expect(metricValue(mounted.container, "Mayor gasto del mes")).toMatch(/800[.,]00/);
    expect(mounted.container.textContent).toContain("Alquiler");
    expect(mounted.container.textContent).not.toContain("Sin gastos este mes");
  });

  it("cuenta los movimientos del histórico, no solo los del mes", () => {
    const history = Array.from({ length: 3 }, (_, index) => ({
      id: `g-${index}`,
      type: "manual" as const,
      date: "2025-01-10",
      amount: 10,
      concept: "Luz",
      categoryLabel: "Servicios básicos",
      commerceName: null,
      receiptUrl: null,
      note: null,
      createdAt: "2025-01-10T12:00:00Z",
      detail: "Luz",
    }));
    mounted = mountComponent(<ExpensesStats expenses={view({ history })} />);

    expect(metricValue(mounted.container, "Movimientos (histórico)")).toBe("3");
  });
});
