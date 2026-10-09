// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, flushAsync, requireElement, submitFormAsync } from "@/test/ui-shared-dom";
import { createRetailSaleAction } from "./actions";
import { RetailManager } from "./retail-manager";

vi.mock("./actions", () => ({
  createRetailSaleAction: vi.fn(),
}));

const saleMock = vi.mocked(createRetailSaleAction);

function retailView(): RetailPageView {
  return {
    products: [
      {
        id: "prod-1",
        name: "Shampoo",
        category: "Cabello",
        salePrice: 15,
        stock: [{ location: "retail", quantity: 4 }],
      },
    ] as RetailPageView["products"],
    customers: [],
    recentSales: [],
    paymentMethodOptions: [{ value: "cash", label: "Efectivo" }],
  } as RetailPageView;
}

function banner(container: HTMLElement): HTMLElement | null {
  const box = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
    (element) => element.className.includes("border-success-border") || element.className.includes("border-danger-border")
  );
  return box ?? null;
}

describe("RetailManager", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    saleMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("abre en Ventas con el formulario de venta rápida y el historial", () => {
    mounted = mountComponent(<RetailManager retail={retailView()} />);

    expect(mounted.container.textContent).toContain("Venta rapida");
    expect(mounted.container.textContent).toContain("Ventas recientes");
  });

  it("cambiar a Productos disponibles muestra la lista de productos y oculta la venta", () => {
    mounted = mountComponent(<RetailManager retail={retailView()} />);

    clickElement(findButtonByText(mounted.container, "Productos disponibles"));

    expect(mounted.container.textContent).not.toContain("Venta rapida");
    expect(mounted.container.textContent).toContain("Shampoo");
  });

  it("una venta exitosa muestra el aviso de éxito y una fallida el aviso de error", async () => {
    saleMock.mockResolvedValueOnce({ ok: true, value: "Venta registrada." });
    mounted = mountComponent(<RetailManager retail={retailView()} />);

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();
    expect(banner(mounted.container)?.textContent).toBe("Venta registrada.");
    expect(banner(mounted.container)?.className).toContain("border-success-border");

    saleMock.mockResolvedValueOnce({ ok: false, error: "Stock insuficiente" });
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();
    expect(banner(mounted.container)?.textContent).toBe("Stock insuficiente");
    expect(banner(mounted.container)?.className).toContain("border-danger-border");
  });

  it("al cambiar de pestaña se limpia el aviso anterior", async () => {
    saleMock.mockResolvedValueOnce({ ok: true, value: "Venta registrada." });
    mounted = mountComponent(<RetailManager retail={retailView()} />);
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();
    expect(banner(mounted.container)).not.toBeNull();

    clickElement(findButtonByText(mounted.container, "Productos disponibles"));

    expect(banner(mounted.container)).toBeNull();
  });
});
