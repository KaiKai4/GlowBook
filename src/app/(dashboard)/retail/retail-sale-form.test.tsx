// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, flushAsync, requireElement, setFieldValue, submitFormAsync } from "@/test/ui-shared-dom";
import { createRetailSaleAction } from "./actions";
import { RetailSaleForm } from "./retail-sale-form";

vi.mock("./actions", () => ({
  createRetailSaleAction: vi.fn(),
}));

const saleMock = vi.mocked(createRetailSaleAction);

type Product = RetailPageView["products"][number];

function product(overrides: Partial<Product>): Product {
  return {
    id: "prod-1",
    name: "Shampoo",
    category: "Cabello",
    salePrice: 15,
    stock: [{ location: "retail", quantity: 4 }],
    ...overrides,
  } as Product;
}

function retailView(products: Product[]): RetailPageView {
  return {
    products,
    customers: [{ id: "cust-1", name: "Ana Pérez" }] as RetailPageView["customers"],
    recentSales: [],
    paymentMethodOptions: [
      { value: "cash", label: "Efectivo" },
      { value: "card", label: "Tarjeta" },
    ],
  } as RetailPageView;
}

function summaryText(container: HTMLElement): string {
  return container.querySelector<HTMLElement>(".bg-brand-50")?.textContent ?? "";
}

function quantityInput(container: HTMLElement): HTMLInputElement {
  return requireElement<HTMLInputElement>(container, 'input[name="quantity"]');
}

describe("RetailSaleForm", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    saleMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("preselecciona el primer producto con su precio y el stock de vitrina", () => {
    mounted = mountComponent(
      <RetailSaleForm
        retail={retailView([product({ salePrice: 15, stock: [{ location: "retail", quantity: 4.9 }] })])}
        onResult={vi.fn()}
      />
    );

    expect(summaryText(mounted.container)).toMatch(/15[.,]00/);
    expect(summaryText(mounted.container)).toContain("Disponible en Vitrina: 4");
    expect(requireElement<HTMLInputElement>(mounted.container, 'input[name="product_id"]').value).toBe("prod-1");
  });

  it("el total es cantidad por precio unitario y la cantidad mínima es 1", () => {
    mounted = mountComponent(
      <RetailSaleForm retail={retailView([product({ salePrice: 12.5 })])} onResult={vi.fn()} />
    );

    setFieldValue(quantityInput(mounted.container), "3");
    expect(summaryText(mounted.container)).toMatch(/37[.,]50/);

    setFieldValue(quantityInput(mounted.container), "0");
    expect(quantityInput(mounted.container).value).toBe("1");
    expect(summaryText(mounted.container)).toMatch(/12[.,]50/);
  });

  it("al cambiar de producto recarga el precio unitario y la disponibilidad", () => {
    mounted = mountComponent(
      <RetailSaleForm
        retail={retailView([
          product({ id: "prod-1", name: "Shampoo", salePrice: 15, stock: [{ location: "retail", quantity: 4 }] }),
          product({ id: "prod-2", name: "Mascarilla", salePrice: 30, stock: [{ location: "retail", quantity: 0 }] }),
        ])}
        onResult={vi.fn()}
      />
    );

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button#producto"));
    const mascarilla = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
      (option) => option.textContent === "Mascarilla"
    );
    if (!mascarilla) throw new Error("Falta la opción Mascarilla");
    clickElement(mascarilla);

    expect(summaryText(mounted.container)).toMatch(/30[.,]00/);
    expect(summaryText(mounted.container)).toContain("Disponible en Vitrina: 0");
  });

  it("al cambiar el origen muestra el stock de esa ubicación", () => {
    mounted = mountComponent(
      <RetailSaleForm
        retail={retailView([
          product({
            stock: [
              { location: "retail", quantity: 2 },
              { location: "storage", quantity: 9 },
            ] as Product["stock"],
          }),
        ])}
        onResult={vi.fn()}
      />
    );

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button#origen"));
    const bodega = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
      (option) => option.textContent === "Bodega"
    );
    if (!bodega) throw new Error("Falta la opción Bodega");
    clickElement(bodega);

    expect(summaryText(mounted.container)).toContain("Disponible en Bodega: 9");
  });

  it("sin productos el botón de registrar queda deshabilitado", () => {
    mounted = mountComponent(<RetailSaleForm retail={retailView([])} onResult={vi.fn()} />);

    expect(findButtonByText(mounted.container, "Registrar venta").disabled).toBe(true);
    expect(summaryText(mounted.container)).toContain("Disponible en Vitrina: 0");
  });

  it("envía la venta a la acción y reporta su resultado", async () => {
    saleMock.mockResolvedValue({ ok: true, value: "Venta registrada." });
    const onResult = vi.fn();
    mounted = mountComponent(<RetailSaleForm retail={retailView([product({})])} onResult={onResult} />);

    setFieldValue(quantityInput(mounted.container), "2");
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(saleMock).toHaveBeenCalledTimes(1);
    const [, formData] = saleMock.mock.calls[0] ?? [];
    expect(formData?.get("product_id")).toBe("prod-1");
    expect(formData?.get("quantity")).toBe("2");
    expect(formData?.get("payment_method")).toBe("cash");
    expect(onResult).toHaveBeenCalledWith({ ok: true, message: "Venta registrada." });
  });

  it("si la venta falla reporta el error al padre", async () => {
    saleMock.mockResolvedValue({ ok: false, error: "Stock insuficiente" });
    const onResult = vi.fn();
    mounted = mountComponent(<RetailSaleForm retail={retailView([product({})])} onResult={onResult} />);

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(onResult).toHaveBeenCalledWith({ ok: false, message: "Stock insuficiente" });
  });
});
