// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText } from "@/test/ui-shared-dom";
import { ReportsView } from "./reports-view";

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

function buildReport(overrides: Partial<OperationalReportViewModel> = {}): OperationalReportViewModel {
  return {
    revenue: 1200,
    retailRevenue: 0,
    grossRevenue: 1200,
    discounts: 0,
    manualExpenses: 0,
    inventoryPurchases: 0,
    totalExpenses: 0,
    estimatedProfit: 1200,
    completedCount: 10,
    totalCount: 12,
    avgTicket: 120,
    noShowRate: 0,
    statusBreakdown: [],
    byEmployee: [],
    byService: [],
    commissions: { rows: [], totalRevenue: 0, totalCommission: 0 },
    from: "2026-10-01",
    to: "2026-10-31",
    preset: "mes",
    newCustomers: 2,
    modules: { inventory: true, retail: false, expenses: true },
    analytics: {
      months: [
        {
          monthKey: "2026-09",
          label: "sep",
          appointmentRevenue: 900,
          retailRevenue: 0,
          totalRevenue: 900,
          operationalExpenses: 100,
          inventoryPurchases: 0,
          totalExpenses: 100,
          profit: 800,
          marginPct: 88.9,
          completedAppointments: 8,
        },
        {
          monthKey: "2026-10",
          label: "oct",
          appointmentRevenue: 1200,
          retailRevenue: 0,
          totalRevenue: 1200,
          operationalExpenses: 150,
          inventoryPurchases: 0,
          totalExpenses: 150,
          profit: 1050,
          marginPct: 87.5,
          completedAppointments: 10,
        },
      ],
      busyHours: [],
      productSales: [],
      topExpenses: [],
      inventoryAlerts: [
        { id: "p-1", name: "Shampoo", retail: 0, internal: 0, storage: 0, total: 0, minimum: 2, state: "agotado" },
        { id: "p-2", name: "Crema", retail: 1, internal: 0, storage: 0, total: 1, minimum: 3, state: "bajo" },
      ],
    },
    yearly: {
      appointmentRevenue: 9000,
      retailRevenue: 0,
      grossRevenue: 9000,
      operationalExpenses: 900,
      inventoryPurchases: 0,
      totalExpenses: 900,
      estimatedProfit: 8100,
      completedAppointments: 75,
    },
    selectedYear: 2026,
    availableYears: [2026, 2025],
    ...overrides,
  };
}

/** Abre el selector del acumulado anual (su disparador muestra el año actual) y elige otro año. */
function chooseYear(container: HTMLElement, year: string): void {
  const native = container.querySelector<HTMLSelectElement>('select[title="Año del acumulado"]');
  const trigger = native?.parentElement?.querySelector<HTMLButtonElement>("button[aria-haspopup='listbox']");
  if (!trigger) throw new Error("No se encontró el selector del acumulado anual");
  clickElement(trigger);
  const option = Array.from(document.body.querySelectorAll<HTMLElement>("[role='option']")).find(
    (candidate) => candidate.textContent?.trim() === `Año ${year}`
  );
  if (!option) throw new Error(`No se encontró la opción ${year}`);
  clickElement(option);
}

describe("ReportsView (pestañas, inventario y módulos)", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.replace.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el mes elegido en español y marca la pestaña Resumen como activa", () => {
    mounted = mountComponent(<ReportsView {...buildReport()} />);

    expect(mounted.container.querySelector("h1")?.textContent).toContain("Reportes");
    expect(mounted.container.textContent).toMatch(/octubre de 2026/i);
    const summary = findButtonByText(mounted.container, "Resumen");
    expect(summary.getAttribute("aria-current")).toBe("page");
    expect(findButtonByText(mounted.container, "Inventario").getAttribute("aria-current")).toBeNull();
  });

  it("cambiar el año del acumulado navega con el rango del mes y el año elegido", () => {
    mounted = mountComponent(<ReportsView {...buildReport()} />);

    chooseYear(mounted.container, "2025");

    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    const href = String(routerMock.replace.mock.calls[0]?.[0]);
    expect(href).toContain("from=2026-10-01");
    expect(href).toContain("to=2026-10-31");
    expect(href).toContain("year=2025");
  });

  it("la pestaña Inventario lista los productos agotados y con stock bajo", () => {
    mounted = mountComponent(<ReportsView {...buildReport()} />);

    clickElement(findButtonByText(mounted.container, "Inventario"));

    expect(mounted.container.textContent).toContain("Shampoo");
    expect(mounted.container.textContent).toContain("Agotado");
    expect(mounted.container.textContent).toContain("Crema");
    expect(mounted.container.textContent).toContain("Stock bajo");
    // Con inventario activo pero sin vitrina, la vitrina aparece como módulo no disponible compacto.
    expect(mounted.container.textContent).toContain("El módulo de Vitrina no está activo.");
  });

  it("sin módulo de inventario la pestaña Inventario muestra el aviso de módulo no disponible", () => {
    mounted = mountComponent(
      <ReportsView {...buildReport({ modules: { inventory: false, retail: false, expenses: false } })} />
    );

    clickElement(findButtonByText(mounted.container, "Inventario"));
    expect(mounted.container.textContent).toContain("El módulo de Inventario no está activo.");

    clickElement(findButtonByText(mounted.container, "Gastos"));
    expect(mounted.container.textContent).toContain("El módulo de Gastos e inventario no está activo.");
  });

  it("la pestaña Finanzas oculta vitrina y gastos cuando sus módulos están inactivos", () => {
    mounted = mountComponent(
      <ReportsView {...buildReport({ modules: { inventory: false, retail: false, expenses: false } })} />
    );

    clickElement(findButtonByText(mounted.container, "Finanzas"));

    expect(mounted.container.textContent).toContain("Ingresos por citas");
    expect(mounted.container.textContent).toContain("Margen de ganancia");
    expect(mounted.container.textContent).toContain("Ganancias por mes");
    expect(mounted.container.textContent).not.toContain("Ingresos por vitrina");
    expect(mounted.container.textContent).not.toContain("Gastos operativos");
  });

  it("la pestaña Citas muestra la liquidación de comisiones por empleado", () => {
    mounted = mountComponent(
      <ReportsView
        {...buildReport({
          commissions: {
            rows: [{ employeeId: "e1", name: "Ana", appointments: 4, revenue: 400, commissionPct: 10, commission: 40 }],
            totalRevenue: 400,
            totalCommission: 40,
          },
        })}
      />
    );

    clickElement(findButtonByText(mounted.container, "Citas"));

    expect(mounted.container.textContent).toContain("Citas agendadas");
    expect(mounted.container.textContent).toContain("Citas canceladas");
    expect(mounted.container.textContent).toContain("Total a pagar");
    expect(mounted.container.textContent).toContain("Ana");
    expect(mounted.container.textContent).toContain("10%");
  });

  it("la pestaña Citas indica cuando no hay comisiones que liquidar", () => {
    mounted = mountComponent(<ReportsView {...buildReport()} />);

    clickElement(findButtonByText(mounted.container, "Citas"));

    expect(mounted.container.textContent).toContain("Sin citas completadas con empleado en este mes.");
  });

  it("la pestaña Gastos resume los egresos y el ranking de gastos principales", () => {
    const base = buildReport();
    mounted = mountComponent(
      <ReportsView {...base} analytics={{ ...base.analytics, topExpenses: [{ label: "Alquiler", amount: 500 }] }} />
    );

    clickElement(findButtonByText(mounted.container, "Gastos"));

    expect(mounted.container.textContent).toContain("Gastos totales");
    expect(mounted.container.textContent).toContain("Gastos de restock");
    expect(mounted.container.textContent).toContain("Gastos y reposiciones");
    expect(mounted.container.textContent).toContain("Top 5 gastos");
    expect(mounted.container.textContent).toContain("Alquiler");
  });

  it("la pestaña Gastos avisa cuando aún no hay gastos para comparar", () => {
    mounted = mountComponent(<ReportsView {...buildReport()} />);

    clickElement(findButtonByText(mounted.container, "Gastos"));

    expect(mounted.container.textContent).toContain("Aún no hay gastos para comparar.");
  });

  it("la tabla de inventario avisa cuando no hay alertas de stock", () => {
    const base = buildReport();
    mounted = mountComponent(
      <ReportsView {...base} analytics={{ ...base.analytics, inventoryAlerts: [] }} />
    );

    clickElement(findButtonByText(mounted.container, "Inventario"));

    expect(mounted.container.querySelector("table[aria-label='Alertas de inventario']")).not.toBeNull();
    expect(mounted.container.textContent).toContain("No hay alertas de stock.");
  });

  it("la tabla de inventario página las alertas de 10 en 10", () => {
    const base = buildReport();
    const alerts = Array.from({ length: 11 }, (_, index) => ({
      id: `p-${index + 1}`,
      name: `Producto ${index + 1}`,
      retail: 0,
      internal: 0,
      storage: 0,
      total: 0,
      minimum: 2,
      state: "agotado" as const,
    }));
    mounted = mountComponent(
      <ReportsView {...base} analytics={{ ...base.analytics, inventoryAlerts: alerts }} />
    );

    clickElement(findButtonByText(mounted.container, "Inventario"));
    expect(mounted.container.textContent).toContain("Página 1 de 2");
    expect(mounted.container.textContent).not.toContain("Producto 11");

    const next = mounted.container.querySelector<HTMLButtonElement>("button[aria-label='Página siguiente']");
    if (!next) throw new Error("No se encontró el botón de página siguiente");
    clickElement(next);
    expect(mounted.container.textContent).toContain("Página 2 de 2");
    expect(mounted.container.textContent).toContain("Producto 11");
  });

  it("el estado de cada alerta se indica con texto e icono además del color", () => {
    mounted = mountComponent(<ReportsView {...buildReport()} />);

    clickElement(findButtonByText(mounted.container, "Inventario"));

    const badges = Array.from(mounted.container.querySelectorAll("table[aria-label='Alertas de inventario'] span.rounded-full"));
    expect(badges.map((badge) => badge.textContent)).toEqual(["Agotado", "Stock bajo"]);
    expect(badges.every((badge) => badge.querySelector("svg") !== null)).toBe(true);
  });

  it("la pestaña Citas muestra el total a pagar y la tabla de comisiones con su aviso vacío", () => {
    mounted = mountComponent(<ReportsView {...buildReport()} />);

    clickElement(findButtonByText(mounted.container, "Citas"));

    expect(mounted.container.querySelector("table[aria-label='Comisiones del mes']")).not.toBeNull();
    expect(mounted.container.textContent).toContain("Total a pagar");
    expect(mounted.container.textContent).toContain("Sin citas completadas con empleado en este mes.");
  });

  it("las tarjetas de Resumen ocultan los egresos cuando sus módulos están inactivos", () => {
    mounted = mountComponent(
      <ReportsView {...buildReport({ modules: { inventory: false, retail: false, expenses: false } })} />
    );

    expect(mounted.container.textContent).toContain("Ingresos del mes");
    expect(mounted.container.textContent).toContain("Ganancia del mes");
    expect(mounted.container.textContent).not.toContain("Egresos del mes");
  });

  it("el valor de la ganancia negativa se muestra con tono de peligro", () => {
    mounted = mountComponent(<ReportsView {...buildReport({ estimatedProfit: -50 })} />);

    const valueParagraph = Array.from(mounted.container.querySelectorAll("p")).find(
      (paragraph) => paragraph.previousElementSibling?.textContent === "Ganancia del mes"
    );
    expect(valueParagraph?.className).toContain("text-danger");
  });
});
