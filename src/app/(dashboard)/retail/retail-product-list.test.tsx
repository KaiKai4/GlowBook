// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { RetailProductList } from "./retail-product-list";

type Product = RetailPageView["products"][number];

function product(overrides: Partial<Product>): Product {
  return {
    id: "prod-1",
    name: "Shampoo",
    category: "Cabello",
    salePrice: 15,
    stock: [{ location: "retail", quantity: 5 }],
    ...overrides,
  } as Product;
}

describe("RetailProductList", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("invita a crear productos en inventario cuando no hay productos", () => {
    mounted = mountComponent(<RetailProductList products={[]} />);

    expect(mounted.container.textContent).toContain("Crea productos en Inventario para vender en vitrina.");
  });

  it("muestra la categoría del producto cuando la tiene", () => {
    mounted = mountComponent(<RetailProductList products={[product({})]} />);

    expect(mounted.container.textContent).toContain("Shampoo");
    expect(mounted.container.textContent).toContain("Cabello");
    expect(mounted.container.textContent).not.toContain("Sin categoria");
  });

  it("comunica el estado de stock de vitrina con texto: agotado, bajo o disponible", () => {
    mounted = mountComponent(
      <RetailProductList
        products={[
          product({ id: "out", stock: [{ location: "retail", quantity: 0 }] }),
          product({ id: "low", stock: [{ location: "retail", quantity: 2 }] }),
          product({ id: "ok", stock: [{ location: "retail", quantity: 9 }] }),
        ]}
      />
    );

    const badges = Array.from(mounted.container.querySelectorAll<HTMLSpanElement>("span.rounded-full"));
    expect(badges.map((badge) => badge.textContent)).toEqual(["Agotado", "Bajo", "Disponible"]);
  });

  it("usa 'Sin categoria' cuando el producto no tiene categoría", () => {
    mounted = mountComponent(<RetailProductList products={[product({ category: "" })]} />);

    expect(mounted.container.textContent).toContain("Sin categoria");
  });
});
