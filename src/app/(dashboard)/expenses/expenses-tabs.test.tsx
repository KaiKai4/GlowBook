// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText } from "@/test/ui-shared-dom";
import { ExpensesTabs } from "./expenses-tabs";

describe("ExpensesTabs", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra las tres pestañas en orden y resalta la activa", () => {
    mounted = mountComponent(<ExpensesTabs activeTab="new" onChange={vi.fn()} />);

    const labels = Array.from(mounted.container.querySelectorAll("button")).map((button) => button.textContent);
    expect(labels).toEqual(["Historial", "Nuevo gasto", "Compra de inventario"]);
    expect(findButtonByText(mounted.container, "Nuevo gasto").className).toContain("bg-brand-600");
    expect(findButtonByText(mounted.container, "Historial").className).not.toContain("bg-brand-600");
  });

  it("al pulsar una pestaña notifica su valor, incluso si ya estaba activa", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<ExpensesTabs activeTab="history" onChange={onChange} />);

    clickElement(findButtonByText(mounted.container, "Compra de inventario"));
    clickElement(findButtonByText(mounted.container, "Historial"));

    expect(onChange.mock.calls.map((call) => call[0])).toEqual(["inventory_purchase", "history"]);
  });

  it("los botones son de tipo button para no disparar envíos de formulario", () => {
    mounted = mountComponent(<ExpensesTabs activeTab="history" onChange={vi.fn()} />);

    for (const button of Array.from(mounted.container.querySelectorAll("button"))) {
      expect(button.type).toBe("button");
    }
  });
});
