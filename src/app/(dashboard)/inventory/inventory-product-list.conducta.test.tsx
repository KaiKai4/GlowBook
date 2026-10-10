// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryProductView } from "@/features/inventory/use-cases/inventory-products";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, requireElement, submitFormAsync } from "@/test/ui-shared-dom";
import { InventoryProductList } from "./inventory-product-list";

type Stock = InventoryProductView["stock"][number];

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
  } as InventoryProductView;
}

function stock(location: Stock["location"], quantity: number, minimumQuantity: number): Stock {
  return { location, quantity, minimumQuantity } as Stock;
}

function handlers(overrides: { pendingForm?: string | null } = {}) {
  return {
    pendingForm: overrides.pendingForm ?? null,
    onSave: vi.fn(),
    onDelete: vi.fn(),
  };
}

/** Abre la ficha de edición del producto desde su fila de la tabla. */
function openEditor(container: HTMLElement): void {
  clickElement(findButtonByText(container, "Editar producto"));
}

/** Textos de cada línea de stock de la tabla (una por ubicación). */
function stockLines(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("li")).map((line) => line.textContent ?? "");
}

describe("InventoryProductList (comportamiento)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra el estado activo o inactivo y si se vende en vitrina", () => {
    mounted = mountComponent(
      <InventoryProductList
        products={[product({ id: "a", isActive: false, isRetailEnabled: false, name: "Tinte" })]}
        {...handlers()}
      />
    );

    expect(mounted.container.textContent).toContain("Inactivo");
    expect(mounted.container.textContent).toContain("Solo inventario/trabajo");
  });

  it("muestra el costo y, solo si se vende en vitrina, también el precio de venta", () => {
    mounted = mountComponent(
      <InventoryProductList products={[product({ id: "a", isRetailEnabled: true })]} {...handlers()} />
    );
    expect(mounted.container.textContent).toMatch(/Costo.*10[.,]00.*Venta.*15[.,]00/);
  });

  it("sin vitrina no muestra el precio de venta ni el stock de vitrina", () => {
    mounted = mountComponent(
      <InventoryProductList
        products={[
          product({
            id: "a",
            isRetailEnabled: false,
            stock: [stock("retail", 3, 1), stock("internal", 2, 0)],
          }),
        ]}
        {...handlers()}
      />
    );

    expect(mounted.container.textContent).not.toContain("Venta");
    expect(stockLines(mounted.container).some((line) => line.startsWith("Vitrina"))).toBe(false);
    expect(stockLines(mounted.container).some((line) => line.startsWith("Uso interno"))).toBe(true);
  });

  it("marca el stock agotado y el que llegó al mínimo con su texto de estado", () => {
    mounted = mountComponent(
      <InventoryProductList
        products={[
          product({
            id: "a",
            stock: [stock("internal", 0, 2), stock("storage", 2, 2), stock("retail", 9, 2)],
            isRetailEnabled: true,
          }),
        ]}
        {...handlers()}
      />
    );

    const lines = stockLines(mounted.container);
    expect(lines.find((line) => line.startsWith("Uso interno"))).toContain("Agotado");
    expect(lines.find((line) => line.startsWith("Bodega"))).toContain("Stock bajo");
    expect(lines.find((line) => line.startsWith("Bodega"))).toContain("Min. 2");
    expect(lines.find((line) => line.startsWith("Vitrina"))).not.toMatch(/Agotado|Stock bajo/);
  });

  it("abre la ficha de edición con el nombre del producto y sin formulario hasta pulsar Editar", () => {
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...handlers()} />);

    expect(mounted.container.querySelector("form")).toBeNull();
    openEditor(mounted.container);

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Shampoo");
    expect(requireElement<HTMLFormElement>(mounted.container, "form")).toBeInstanceOf(HTMLFormElement);
  });

  it("el formulario de edición entrega el id del producto y los campos al guardar", async () => {
    const props = handlers();
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...props} />);
    openEditor(mounted.container);

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave.mock.calls[0]?.[0]).toBe("prod-9");
    const formData = props.onSave.mock.calls[0]?.[1] as FormData;
    expect(formData.get("name")).toBe("Shampoo");
    expect(formData.get("is_active")).toBe("true");
    expect(formData.get("is_retail_enabled")).toBe("true");
  });

  it("el botón Guardar producto muestra la carga mientras se guarda ese producto", () => {
    mounted = mountComponent(
      <InventoryProductList products={[product({ id: "prod-9" })]} {...handlers({ pendingForm: "edit:prod-9" })} />
    );
    openEditor(mounted.container);

    const save = findButtonByText(mounted.container, "Guardar producto");
    expect(save.disabled).toBe(true);
    expect(save.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("no muestra carga en la ficha de otro producto aunque haya un guardado en curso", () => {
    mounted = mountComponent(
      <InventoryProductList products={[product({ id: "prod-9" })]} {...handlers({ pendingForm: "edit:otro" })} />
    );
    openEditor(mounted.container);

    expect(findButtonByText(mounted.container, "Guardar producto").disabled).toBe(false);
  });

  it("Escape cierra la ficha de edición sin guardar nada", () => {
    const props = handlers();
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...props} />);
    openEditor(mounted.container);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("eliminar exige confirmación: Cancelar vuelve atrás sin borrar", () => {
    const props = handlers();
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...props} />);
    openEditor(mounted.container);

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));
    expect(mounted.container.textContent).toContain("Se ocultara de Inventario y Vitrina");

    clickElement(findButtonByText(mounted.container, "Cancelar"));

    expect(props.onDelete).not.toHaveBeenCalled();
    expect(findButtonByText(mounted.container, "Eliminar producto")).toBeInstanceOf(HTMLButtonElement);
  });

  it("confirmar eliminar llama a onDelete con el id del producto", () => {
    const props = handlers();
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...props} />);
    openEditor(mounted.container);

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));
    clickElement(findButtonByText(mounted.container, "Confirmar eliminar"));

    expect(props.onDelete).toHaveBeenCalledWith("prod-9");
    expect(findButtonByText(mounted.container, "Eliminar producto")).toBeInstanceOf(HTMLButtonElement);
  });

  it("con eliminación en curso el botón de confirmar muestra la carga", () => {
    mounted = mountComponent(
      <InventoryProductList products={[product({ id: "prod-9" })]} {...handlers({ pendingForm: "delete:prod-9" })} />
    );
    openEditor(mounted.container);

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));

    const confirm = findButtonByText(mounted.container, "Confirmar eliminar");
    expect(confirm.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
