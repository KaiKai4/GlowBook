// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { RetailSalesHistory } from "./retail-sales-history";

type Sale = RetailPageView["recentSales"][number];

function sale(overrides: Partial<Sale>): Sale {
  return {
    id: "sale-1",
    customer: null,
    note: "",
    payment_method: "cash",
    total_amount: 30,
    ...overrides,
  } as Sale;
}

describe("RetailSalesHistory", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("indica que no hay ventas registradas cuando la lista está vacía", () => {
    mounted = mountComponent(<RetailSalesHistory sales={[]} />);

    expect(mounted.container.textContent).toContain("Sin ventas registradas todavia.");
  });

  it("identifica la venta como 'Venta sin cliente' y muestra 'Sin nota' cuando no hay datos", () => {
    mounted = mountComponent(<RetailSalesHistory sales={[sale({ customer: null, note: "" })]} />);

    expect(mounted.container.textContent).toContain("Venta sin cliente");
    expect(mounted.container.textContent).toContain("Sin nota");
  });

  it("muestra el nombre del cliente cuando la relación llega como objeto o como arreglo", () => {
    const customer = { first_name: "Ana", last_name: "Pérez" };
    const asObject = mountComponent(<RetailSalesHistory sales={[sale({ customer: customer as Sale["customer"] })]} />);
    expect(asObject.container.textContent).toContain("Ana Pérez");
    asObject.unmount();

    mounted = mountComponent(<RetailSalesHistory sales={[sale({ customer: [customer] as Sale["customer"] })]} />);
    expect(mounted.container.textContent).toContain("Ana Pérez");
  });

  it("muestra la nota real de la venta", () => {
    mounted = mountComponent(<RetailSalesHistory sales={[sale({ note: "Regalo de cumpleaños" })]} />);

    expect(mounted.container.textContent).toContain("Regalo de cumpleaños");
    expect(mounted.container.textContent).not.toContain("Sin nota");
  });
});
