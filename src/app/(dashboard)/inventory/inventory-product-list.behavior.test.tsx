// @vitest-environment jsdom
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

function stockBox(container: HTMLElement, label: string): HTMLElement {
  const heading = Array.from(container.querySelectorAll<HTMLElement>("p")).find((node) => node.textContent === label);
  const box = heading?.parentElement;
  if (!box) throw new Error(`Falta la caja de stock ${label}`);
  return box;
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
    // El formulario de edición sí lista todos los stocks; lo que debe faltar es la caja de vitrina.
    const stockHeadings = Array.from(mounted.container.querySelectorAll("p")).map((node) => node.textContent);
    expect(stockHeadings).not.toContain("Vitrina");
    expect(mounted.container.textContent).toContain("Uso interno");
  });

  it("marca en rojo el stock agotado y en ámbar el que llegó al mínimo", () => {
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

    expect(stockBox(mounted.container, "Uso interno").querySelector("p.text-xl")?.className).toContain("text-danger");
    expect(stockBox(mounted.container, "Bodega").querySelector("p.text-xl")?.className).toContain("text-warning-fg");
    const retailValue = stockBox(mounted.container, "Vitrina").querySelector("p.text-xl")?.className ?? "";
    expect(retailValue).toContain("text-fg");
    expect(retailValue).not.toContain("text-danger");
    expect(retailValue).not.toContain("text-warning-fg");
    expect(stockBox(mounted.container, "Bodega").textContent).toContain("Min. 2");
  });

  it("el formulario de edición entrega el id del producto y los campos al guardar", async () => {
    const props = handlers();
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...props} />);

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

    const save = findButtonByText(mounted.container, "Guardar producto");
    expect(save.disabled).toBe(true);
    expect(save.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("no muestra carga en otros productos aunque haya un guardado en curso", () => {
    mounted = mountComponent(
      <InventoryProductList products={[product({ id: "prod-9" })]} {...handlers({ pendingForm: "edit:otro" })} />
    );

    expect(findButtonByText(mounted.container, "Guardar producto").disabled).toBe(false);
  });

  it("eliminar exige confirmación: Cancelar vuelve atrás sin borrar", () => {
    const props = handlers();
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...props} />);

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));
    expect(mounted.container.textContent).toContain("Se ocultara de Inventario y Vitrina");

    clickElement(findButtonByText(mounted.container, "Cancelar"));

    expect(props.onDelete).not.toHaveBeenCalled();
    expect(findButtonByText(mounted.container, "Eliminar producto")).toBeInstanceOf(HTMLButtonElement);
  });

  it("confirmar eliminar llama a onDelete con el id del producto", () => {
    const props = handlers();
    mounted = mountComponent(<InventoryProductList products={[product({ id: "prod-9" })]} {...props} />);

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));
    clickElement(findButtonByText(mounted.container, "Confirmar eliminar"));

    expect(props.onDelete).toHaveBeenCalledWith("prod-9");
    expect(mounted.container.textContent).toContain("Eliminar producto");
  });

  it("con eliminación en curso el botón de confirmar muestra la carga", () => {
    mounted = mountComponent(
      <InventoryProductList products={[product({ id: "prod-9" })]} {...handlers({ pendingForm: "delete:prod-9" })} />
    );

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));

    const confirm = findButtonByText(mounted.container, "Confirmar eliminar");
    expect(confirm.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
