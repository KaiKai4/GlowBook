// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText } from "@/test/ui-shared-dom";
import { InventoryTabs } from "./inventory-tabs";

describe("InventoryTabs", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("ofrece Productos, Transferir stock, Nuevo producto y Movimientos en ese orden", () => {
    mounted = mountComponent(<InventoryTabs activeTab="products" onChange={vi.fn()} />);

    const labels = Array.from(mounted.container.querySelectorAll("button")).map((button) => button.textContent);
    expect(labels).toEqual(["Productos", "Transferir stock", "Nuevo producto", "Movimientos"]);
  });

  it("resalta la pestaña activa y notifica el cambio al pulsar otra", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<InventoryTabs activeTab="movements" onChange={onChange} />);

    expect(findButtonByText(mounted.container, "Movimientos").className).toContain("bg-accent-subtle");
    clickElement(findButtonByText(mounted.container, "Nuevo producto"));

    expect(onChange).toHaveBeenCalledWith("product");
  });
});
