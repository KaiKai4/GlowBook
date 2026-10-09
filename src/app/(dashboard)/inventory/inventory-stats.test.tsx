// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { InventoryPageView } from "@/features/inventory/use-cases/inventory-products";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { InventoryStats } from "./inventory-stats";

function inventoryView(overrides: Partial<InventoryPageView>): InventoryPageView {
  return { products: [], lowStock: [], recentMovements: [], ...overrides } as InventoryPageView;
}

function metricNode(container: HTMLElement, label: string): HTMLElement | null {
  const labelNode = Array.from(container.querySelectorAll("p")).find((node) => node.textContent === label);
  return labelNode?.nextElementSibling as HTMLElement | null;
}

describe("InventoryStats", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("cuenta productos y movimientos recientes", () => {
    mounted = mountComponent(
      <InventoryStats
        inventory={inventoryView({
          products: [{ id: "a" }, { id: "b" }, { id: "c" }] as InventoryPageView["products"],
          recentMovements: [{ id: "m1" }] as InventoryPageView["recentMovements"],
        })}
      />
    );

    expect(metricNode(mounted.container, "Productos")?.textContent).toBe("3");
    expect(metricNode(mounted.container, "Movimientos recientes")?.textContent).toBe("1");
  });

  it("resalta en advertencia los productos bajos o agotados cuando hay alguno", () => {
    mounted = mountComponent(
      <InventoryStats
        inventory={inventoryView({ lowStock: [{ id: "x" }] as InventoryPageView["lowStock"] })}
      />
    );

    const value = metricNode(mounted.container, "Bajos o agotados");
    expect(value?.textContent).toBe("1");
    expect(value?.className).toContain("text-warning-fg");
  });

  it("sin productos bajos muestra el indicador en tono correcto", () => {
    mounted = mountComponent(<InventoryStats inventory={inventoryView({})} />);

    const value = metricNode(mounted.container, "Bajos o agotados");
    expect(value?.textContent).toBe("0");
    expect(value?.className).toContain("text-success-fg");
  });
});
