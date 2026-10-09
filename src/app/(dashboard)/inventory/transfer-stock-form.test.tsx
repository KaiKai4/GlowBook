// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryProductView } from "@/features/inventory/use-cases/inventory-products";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { TransferStockForm } from "./transfer-stock-form";

function product(overrides: Partial<InventoryProductView>): InventoryProductView {
  return {
    id: "prod-1",
    name: "Tinte",
    category: "Color",
    costPrice: 8,
    salePrice: 0,
    isRetailEnabled: false,
    isActive: true,
    totalQuantity: 4,
    stock: [],
    ...overrides,
  };
}

describe("TransferStockForm", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("fija el destino a Uso interno y lo muestra como texto cuando el producto no va a vitrina", () => {
    mounted = mountComponent(
      <TransferStockForm products={[product({ isRetailEnabled: false })]} pending={false} onTransfer={vi.fn()} />
    );

    const hidden = mounted.container.querySelector<HTMLInputElement>('input[name="to_location"]');
    expect(hidden?.value).toBe("internal");
    expect(mounted.container.textContent).toContain("Hacia");
    expect(mounted.container.textContent).toContain("Uso interno");
  });

  it("ofrece elegir destino cuando el producto también se vende en vitrina", () => {
    mounted = mountComponent(
      <TransferStockForm products={[product({ isRetailEnabled: true })]} pending={false} onTransfer={vi.fn()} />
    );

    // El Select del formulario guarda el destino en un input oculto: por defecto, vitrina.
    const hidden = mounted.container.querySelector<HTMLInputElement>('input[name="to_location"]');
    expect(hidden?.value).toBe("retail");
  });
});
