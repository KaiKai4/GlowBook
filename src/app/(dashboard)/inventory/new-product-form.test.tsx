// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, requireElement, submitFormAsync } from "@/test/ui-shared-dom";
import { NewProductForm } from "./new-product-form";

function field(container: HTMLElement, name: string): HTMLInputElement {
  return requireElement<HTMLInputElement>(container, `input[name="${name}"]`);
}

describe("NewProductForm", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("por defecto el producto se vende en vitrina: el precio y el stock de vitrina están activos", () => {
    mounted = mountComponent(<NewProductForm pending={false} onCreate={vi.fn()} />);

    expect(field(mounted.container, "sale_price").disabled).toBe(false);
    expect(field(mounted.container, "retail_quantity").disabled).toBe(false);
    expect(field(mounted.container, "internal_quantity").disabled).toBe(false);
  });

  it("si el producto no se vende en vitrina deshabilita precio y stock de vitrina", () => {
    mounted = mountComponent(<NewProductForm pending={false} onCreate={vi.fn()} />);

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button#se-vende-en-vitrina"));
    const no = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((option) =>
      option.textContent?.startsWith("No,")
    );
    if (!no) throw new Error("Falta la opción No");
    clickElement(no);

    expect(field(mounted.container, "sale_price").disabled).toBe(true);
    expect(field(mounted.container, "retail_quantity").disabled).toBe(true);
    expect(field(mounted.container, "retail_minimum").disabled).toBe(true);
    expect(field(mounted.container, "storage_quantity").disabled).toBe(false);
  });

  it("el costo arranca en 0 y el envío entrega todos los datos del producto al padre", async () => {
    const onCreate = vi.fn();
    mounted = mountComponent(<NewProductForm pending={false} onCreate={onCreate} />);

    expect(field(mounted.container, "cost_price").value).toBe("0");
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const formData = onCreate.mock.calls[0]?.[0] as FormData;
    expect(formData.get("cost_price")).toBe("0");
    expect(formData.get("is_retail_enabled")).toBe("true");
  });

  it("en curso de guardado el botón muestra estado de carga", () => {
    mounted = mountComponent(<NewProductForm pending onCreate={vi.fn()} />);

    const submit = findButtonByText(mounted.container, "Crear producto");
    expect(submit.disabled).toBe(true);
    expect(submit.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
