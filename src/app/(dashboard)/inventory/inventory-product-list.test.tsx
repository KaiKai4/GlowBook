// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryProductView } from "@/features/inventory/use-cases/inventory-products";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { InventoryProductList } from "./inventory-product-list";

function product(overrides: Partial<InventoryProductView>): InventoryProductView {
  return {
    id: "prod-1",
    name: "Shampoo",
    category: "Cabello",
    costPrice: 10,
    salePrice: 15,
    isRetailEnabled: true,
    isActive: true,
    totalQuantity: 5,
    stock: [],
    ...overrides,
  };
}

const handlers = () => ({
  pendingForm: null,
  onSave: vi.fn(),
  onDelete: vi.fn(),
});

describe("InventoryProductList", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("indica que no hay productos registrados cuando la lista está vacía", () => {
    mounted = mountComponent(<InventoryProductList products={[]} {...handlers()} />);

    expect(mounted.container.textContent).toContain("Aun no hay productos registrados.");
  });

  it("muestra la categoría del producto cuando la tiene", () => {
    mounted = mountComponent(<InventoryProductList products={[product({})]} {...handlers()} />);

    expect(mounted.container.textContent).toContain("Shampoo");
    expect(mounted.container.textContent).toContain("Cabello");
    expect(mounted.container.textContent).not.toContain("Sin categoria");
  });

  it("usa 'Sin categoria' cuando el producto no tiene categoría", () => {
    mounted = mountComponent(<InventoryProductList products={[product({ category: "" })]} {...handlers()} />);

    expect(mounted.container.textContent).toContain("Sin categoria");
  });
});
