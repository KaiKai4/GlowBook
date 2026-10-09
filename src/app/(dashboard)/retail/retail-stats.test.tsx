// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { RetailStats } from "./retail-stats";

function retailView(overrides: Partial<RetailPageView>): RetailPageView {
  return {
    products: [],
    customers: [],
    recentSales: [],
    paymentMethodOptions: [],
    ...overrides,
  } as RetailPageView;
}

function metric(container: HTMLElement, label: string): string | null {
  const labelNode = Array.from(container.querySelectorAll("p")).find((node) => node.textContent === label);
  return labelNode?.nextElementSibling?.textContent ?? null;
}

describe("RetailStats", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("sin datos muestra cero productos, cero ventas y un ingreso nulo", () => {
    mounted = mountComponent(<RetailStats retail={retailView({})} />);

    expect(metric(mounted.container, "Productos activos")).toBe("0");
    expect(metric(mounted.container, "Ventas recientes")).toBe("0");
    expect(metric(mounted.container, "Ingreso reciente")).toMatch(/0[.,]00/);
  });

  it("suma el total de las ventas recientes aceptando importes como texto", () => {
    mounted = mountComponent(
      <RetailStats
        retail={retailView({
          products: [{ id: "p1" }, { id: "p2" }] as RetailPageView["products"],
          recentSales: [
            { total_amount: 15 },
            { total_amount: "22.5" },
            { total_amount: null },
          ] as RetailPageView["recentSales"],
        })}
      />
    );

    expect(metric(mounted.container, "Productos activos")).toBe("2");
    expect(metric(mounted.container, "Ventas recientes")).toBe("3");
    expect(metric(mounted.container, "Ingreso reciente")).toMatch(/37[.,]50/);
  });
});
