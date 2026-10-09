// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { ProductMonthlySales, ReportMonthPoint } from "@/features/reports/domain/analytics";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { MonthlyAreaChart, ProductSalesChart } from "./report-charts";

// La línea del indicador activo es la única con el color de marca brand-300.
const INDICATOR = 'line[stroke="var(--color-brand-300)"]';

type AreaSeries = Parameters<typeof MonthlyAreaChart>[0]["series"][number];

function monthPoint(monthKey: string, label: string, totalRevenue: number): ReportMonthPoint {
  return {
    monthKey,
    label,
    appointmentRevenue: totalRevenue,
    retailRevenue: 0,
    totalRevenue,
    operationalExpenses: 0,
    inventoryPurchases: 0,
    totalExpenses: 0,
    profit: totalRevenue,
    marginPct: 100,
    completedAppointments: 1,
  };
}

const revenueSeries: AreaSeries[] = [
  {
    key: "totalRevenue",
    label: "Ingresos",
    color: "#7c3aed",
    fill: "#ede9fe",
    value: (point) => point.totalRevenue,
  },
];

const months = [monthPoint("2026-04", "Abril 2026", 120), monthPoint("2026-05", "Mayo 2026", 300)];

describe("MonthlyAreaChart", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("expone el título, la descripción y la leyenda de cada serie", () => {
    mounted = mountComponent(
      <MonthlyAreaChart title="Ingresos del periodo" description="Por mes" points={months} series={revenueSeries} />
    );

    expect(mounted.container.textContent).toContain("Ingresos del periodo");
    expect(mounted.container.textContent).toContain("Ingresos");
    const group = mounted.container.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-label")).toBe("Ingresos del periodo. Por mes");
  });

  it("muestra el detalle del mes al enfocarlo y lo oculta al salir", () => {
    mounted = mountComponent(
      <MonthlyAreaChart title="Ingresos" description="Por mes" points={months} series={revenueSeries} />
    );
    const buttons = Array.from(mounted.container.querySelectorAll<SVGRectElement>('rect[role="button"]'));
    const may = buttons[1];
    expect(may?.getAttribute("aria-label")).toBe("Mayo 2026");

    act(() => {
      may?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(mounted.container.querySelector(INDICATOR)).not.toBeNull();

    act(() => {
      may?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(mounted.container.querySelector(INDICATOR)).toBeNull();
  });

  it("no pinta el indicador activo antes de interactuar", () => {
    mounted = mountComponent(
      <MonthlyAreaChart title="Ingresos" description="Por mes" points={months} series={revenueSeries} />
    );

    expect(mounted.container.querySelector(INDICATOR)).toBeNull();
  });
});

describe("ProductSalesChart", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("indica que no hay ventas de productos cuando la lista está vacía", () => {
    mounted = mountComponent(<ProductSalesChart products={[]} months={months} />);

    expect(mounted.container.textContent).toContain("Aún no hay ventas de productos para graficar.");
  });

  it("escala las barras al máximo y trata los meses sin dato como cero", () => {
    const products: ProductMonthlySales[] = [{ id: "p1", name: "Shampoo", total: 2, months: [2] }];

    mounted = mountComponent(<ProductSalesChart products={products} months={months} />);

    const bars = Array.from(mounted.container.querySelectorAll<HTMLElement>("div[title]"));
    expect(bars.map((bar) => bar.style.height)).toEqual(["190px", "0px"]);
    expect(mounted.container.textContent).toContain("Shampoo");
  });

  it("indica cero unidades en el titulo de los meses sin dato, nunca 'undefined'", () => {
    const products: ProductMonthlySales[] = [{ id: "p1", name: "Shampoo", total: 2, months: [2] }];

    mounted = mountComponent(<ProductSalesChart products={products} months={months} />);

    const titles = Array.from(mounted.container.querySelectorAll<HTMLElement>("div[title]")).map((bar) => bar.title);
    expect(titles.join("|")).not.toContain("undefined");
    expect(titles[1]).toMatch(/: 0 unidades$/);
  });
});
