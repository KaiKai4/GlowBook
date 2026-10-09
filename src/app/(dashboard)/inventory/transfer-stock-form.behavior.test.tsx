// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryProductView } from "@/features/inventory/use-cases/inventory-products";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  clickElement,
  findButtonByText,
  requireElement,
  setFieldValue,
  submitFormAsync,
} from "@/test/ui-shared-dom";
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
  } as InventoryProductView;
}

function optionByText(text: string): HTMLButtonElement {
  const option = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
    (candidate) => candidate.textContent === text
  );
  if (!option) throw new Error(`Falta la opción ${text}`);
  return option;
}

function hiddenValue(container: HTMLElement, name: string): string | undefined {
  return container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
}

describe("TransferStockForm (comportamiento)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("al elegir un producto de vitrina el destino vuelve a Vitrina y se puede cambiar a Uso interno", () => {
    mounted = mountComponent(
      <TransferStockForm
        products={[product({ id: "p1", name: "Tinte", isRetailEnabled: false }), product({ id: "p2", name: "Shampoo", isRetailEnabled: true })]}
        pending={false}
        onTransfer={vi.fn()}
      />
    );
    expect(hiddenValue(mounted.container, "to_location")).toBe("internal");

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button#producto"));
    clickElement(optionByText("Shampoo"));

    // Con un producto de vitrina el destino pasa a ser un selector con Vitrina por defecto.
    expect(hiddenValue(mounted.container, "to_location")).toBe("retail");
    expect(requireElement<HTMLButtonElement>(mounted.container, "button#hacia").textContent).toContain("Vitrina");

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button#hacia"));
    clickElement(optionByText("Uso interno"));

    expect(requireElement<HTMLButtonElement>(mounted.container, "button#hacia").textContent).toContain("Uso interno");
  });

  it("al cambiar a un producto que no es de vitrina el destino vuelve a Uso interno sin selector", () => {
    mounted = mountComponent(
      <TransferStockForm
        products={[product({ id: "p1", name: "Shampoo", isRetailEnabled: true }), product({ id: "p2", name: "Tinte", isRetailEnabled: false })]}
        pending={false}
        onTransfer={vi.fn()}
      />
    );
    expect(mounted.container.querySelector("button#hacia")).not.toBeNull();

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button#producto"));
    clickElement(optionByText("Tinte"));

    expect(hiddenValue(mounted.container, "to_location")).toBe("internal");
    expect(mounted.container.querySelector("button#hacia")).toBeNull();
  });

  it("envía origen Bodega, destino, producto, cantidad y nota a la acción de transferencia", async () => {
    const onTransfer = vi.fn();
    mounted = mountComponent(
      <TransferStockForm products={[product({ id: "p1", isRetailEnabled: false })]} pending={false} onTransfer={onTransfer} />
    );

    setFieldValue(requireElement<HTMLInputElement>(mounted.container, 'input[name="quantity"]'), "1.5");
    setFieldValue(requireElement<HTMLTextAreaElement>(mounted.container, 'textarea[name="note"]'), "Reposición semanal");
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));

    expect(onTransfer).toHaveBeenCalledTimes(1);
    const formData = onTransfer.mock.calls[0]?.[0] as FormData;
    expect(formData.get("from_location")).toBe("storage");
    expect(formData.get("to_location")).toBe("internal");
    expect(formData.get("product_id")).toBe("p1");
    expect(formData.get("quantity")).toBe("1.5");
    expect(formData.get("note")).toBe("Reposición semanal");
  });

  it("con transferencia en curso el botón muestra la carga y no se puede pulsar", () => {
    mounted = mountComponent(
      <TransferStockForm products={[product({})]} pending onTransfer={vi.fn()} />
    );

    const button = findButtonByText(mounted.container, "Transferir");
    expect(button.disabled).toBe(true);
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("sin productos el destino sigue siendo Uso interno y no hay producto preseleccionado", () => {
    mounted = mountComponent(<TransferStockForm products={[]} pending={false} onTransfer={vi.fn()} />);

    expect(hiddenValue(mounted.container, "to_location")).toBe("internal");
    expect(mounted.container.textContent).toContain("Uso interno");
    expect(hiddenValue(mounted.container, "product_id")).toBe("");
  });
});
