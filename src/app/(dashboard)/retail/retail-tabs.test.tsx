// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText } from "@/test/ui-shared-dom";
import { RetailTabs } from "./retail-tabs";

describe("RetailTabs", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra las pestañas Ventas y Productos disponibles, resaltando la activa", () => {
    mounted = mountComponent(<RetailTabs activeTab="products" onChange={vi.fn()} />);

    expect(findButtonByText(mounted.container, "Productos disponibles").className).toContain("bg-brand-600");
    expect(findButtonByText(mounted.container, "Ventas").className).not.toContain("bg-brand-600");
  });

  it("notifica la pestaña pulsada", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<RetailTabs activeTab="sales" onChange={onChange} />);

    clickElement(findButtonByText(mounted.container, "Productos disponibles"));

    expect(onChange).toHaveBeenCalledWith("products");
  });
});
