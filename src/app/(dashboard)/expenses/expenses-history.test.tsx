// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ExpenseHistoryItem } from "@/features/expenses/use-cases/expenses";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, requireElement, setFieldValue } from "@/test/ui-shared-dom";
import { ExpensesHistory } from "./expenses-history";

function item(overrides: Partial<ExpenseHistoryItem>): ExpenseHistoryItem {
  return {
    id: "exp-1",
    type: "manual",
    date: "2026-05-10",
    amount: 100,
    concept: "Luz de mayo",
    categoryLabel: "Servicios básicos",
    commerceName: "Naturgy",
    receiptUrl: null,
    note: null,
    createdAt: "2026-05-10T12:00:00Z",
    detail: "Recibo mensual",
    ...overrides,
  };
}

const HISTORY: ExpenseHistoryItem[] = [
  item({ id: "a", concept: "Luz de mayo", amount: 100, date: "2026-05-10" }),
  item({
    id: "b",
    type: "inventory_purchase",
    concept: "Tintes",
    categoryLabel: "Compra de inventario",
    amount: 250.5,
    date: "2026-06-01",
    commerceName: null,
    receiptUrl: "https://example.com/factura.pdf",
    detail: "Lote de tintes",
  }),
  item({ id: "c", concept: "Alquiler", amount: 800, date: "2026-04-01", commerceName: "Arrendador" }),
];

function rows(container: HTMLElement): string[] {
  // Cada fila tiene la clase de grid de cuatro columnas en la versión de escritorio.
  return Array.from(container.querySelectorAll<HTMLElement>(".border-t")).map((row) => row.textContent ?? "");
}

function totalText(container: HTMLElement): string {
  return requireElement<HTMLElement>(container, ".text-red-600.text-lg").textContent ?? "";
}

describe("ExpensesHistory", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("lista todos los egresos y suma el total filtrado", () => {
    mounted = mountComponent(<ExpensesHistory history={HISTORY} />);

    expect(rows(mounted.container)).toHaveLength(3);
    expect(totalText(mounted.container)).toMatch(/1.?150[.,]50/);
  });

  it("muestra el tipo, el comprobante cuando existe y 'Sin registrar' sin comercio", () => {
    mounted = mountComponent(<ExpensesHistory history={HISTORY} />);

    const receipt = requireElement<HTMLAnchorElement>(mounted.container, "a");
    expect(receipt.textContent).toBe("Ver comprobante");
    expect(receipt.getAttribute("href")).toBe("https://example.com/factura.pdf");
    expect(receipt.getAttribute("target")).toBe("_blank");
    expect(receipt.getAttribute("rel")).toBe("noopener noreferrer");
    expect(mounted.container.textContent).toContain("Sin registrar");
    expect(mounted.container.textContent).toContain("Compra de inventario");
  });

  it("filtra por texto libre en cualquier campo (comercio, nota, detalle o tipo)", () => {
    mounted = mountComponent(<ExpensesHistory history={HISTORY} />);

    setFieldValue(requireElement<HTMLInputElement>(mounted.container, 'input[placeholder="Comercio, nota, producto..."]'), "arrendador");

    expect(rows(mounted.container)).toHaveLength(1);
    expect(totalText(mounted.container)).toMatch(/800[.,]00/);
  });

  it("filtra por concepto sin distinguir mayúsculas ni espacios laterales", () => {
    mounted = mountComponent(<ExpensesHistory history={HISTORY} />);

    setFieldValue(requireElement<HTMLInputElement>(mounted.container, 'input[placeholder="Luz, inventario, equipo..."]'), "  TINTES ");

    expect(rows(mounted.container)).toHaveLength(1);
    expect(mounted.container.textContent).toContain("Lote de tintes");
  });

  it("filtra por tipo de egreso", () => {
    mounted = mountComponent(<ExpensesHistory history={HISTORY} />);

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button[aria-haspopup='listbox']"));
    const option = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
      (candidate) => candidate.textContent === "Gasto general"
    );
    if (!option) throw new Error("Falta la opción Gasto general");
    clickElement(option);

    expect(rows(mounted.container)).toHaveLength(2);
    expect(mounted.container.textContent).not.toContain("Tintes");
  });

  it("filtra por rango de fechas inclusivo en ambos extremos", () => {
    mounted = mountComponent(<ExpensesHistory history={HISTORY} />);

    const dateInputs = mounted.container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    const desde = dateInputs[0];
    if (!desde) throw new Error("Falta el filtro Desde");
    setFieldValue(desde, "2026-05-01");
    const hasta = dateInputs[1];
    if (!hasta) throw new Error("Falta el filtro Hasta");
    setFieldValue(hasta, "2026-06-01");

    expect(rows(mounted.container)).toHaveLength(2);
    expect(mounted.container.textContent).not.toContain("Alquiler");
  });

  it("sin coincidencias muestra el aviso de filtros vacíos y total cero", () => {
    mounted = mountComponent(<ExpensesHistory history={HISTORY} />);

    setFieldValue(requireElement<HTMLInputElement>(mounted.container, 'input[placeholder="Comercio, nota, producto..."]'), "inexistente");

    expect(mounted.container.textContent).toContain("No hay egresos con esos filtros.");
    expect(totalText(mounted.container)).toMatch(/0[.,]00/);
  });

  it("sin historial muestra el aviso de vacío desde el inicio", () => {
    mounted = mountComponent(<ExpensesHistory history={[]} />);

    expect(mounted.container.textContent).toContain("No hay egresos con esos filtros.");
  });

  it("no muestra el enlace del comprobante si no es https", () => {
    mounted = mountComponent(
      <ExpensesHistory history={[item({ id: "x", receiptUrl: "javascript:alert(1)" })]} />
    );

    expect(mounted.container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(mounted.container.textContent).not.toContain("Ver comprobante");
  });
});
