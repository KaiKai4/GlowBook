// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => toast,
}));
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { findButtonByText, requireElement, setFieldValue } from "@/test/ui-shared-dom";
import { createRetailSaleAction } from "./actions";
import { RetailSaleForm } from "./retail-sale-form";

vi.mock("./actions", () => ({
  createRetailSaleAction: vi.fn(),
}));

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

function view(overrides: Partial<RetailPageView>): RetailPageView {
  return {
    products: [product({})],
    customers: [],
    recentSales: [],
    paymentMethodOptions: [{ value: "cash", label: "Efectivo" }],
    ...overrides,
  } as RetailPageView;
}

function summaryText(container: HTMLElement): string {
  return container.querySelector<HTMLElement>(".bg-brand-50")?.textContent ?? "";
}

function unitPriceInput(container: HTMLElement): HTMLInputElement {
  return requireElement<HTMLInputElement>(container, 'input[name="unit_price"]');
}

describe("RetailSaleForm (casos de borde)", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(createRetailSaleAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("el precio unitario editado a mano recalcula el total de la venta", () => {
    mounted = mountComponent(<RetailSaleForm retail={view({})} onResult={vi.fn()} />);

    setFieldValue(unitPriceInput(mounted.container), "2.5");
    setFieldValue(requireElement<HTMLInputElement>(mounted.container, 'input[name="quantity"]'), "4");

    expect(summaryText(mounted.container)).toMatch(/10[.,]00/);
  });

  it("un precio vacío cuenta como 0 y el total queda en cero", () => {
    mounted = mountComponent(<RetailSaleForm retail={view({})} onResult={vi.fn()} />);

    setFieldValue(unitPriceInput(mounted.container), "");

    expect(summaryText(mounted.container)).toMatch(/0[.,]00/);
  });

  it("si la ubicación elegida no tiene stock del producto, la disponibilidad es cero", () => {
    mounted = mountComponent(
      <RetailSaleForm retail={view({ products: [product({ stock: [{ location: "storage", quantity: 6 }] as Product["stock"] })] })} onResult={vi.fn()} />
    );

    expect(summaryText(mounted.container)).toContain("Disponible en Vitrina: 0");
  });

  it("las cantidades fraccionarias de stock se muestran como unidades enteras disponibles", () => {
    mounted = mountComponent(
      <RetailSaleForm retail={view({ products: [product({ stock: [{ location: "retail", quantity: 2.9 }] as Product["stock"] })] })} onResult={vi.fn()} />
    );

    expect(summaryText(mounted.container)).toContain("Disponible en Vitrina: 2");
  });

  it("sin métodos de pago configurados el selector queda sin opciones y el envío usa el valor por defecto", () => {
    mounted = mountComponent(
      <RetailSaleForm retail={view({ paymentMethodOptions: [] })} onResult={vi.fn()} />
    );

    expect(requireElement<HTMLInputElement>(mounted.container, 'input[name="payment_method"]').value).toBe("cash");
  });

  it("con un producto seleccionado el botón Registrar venta queda habilitado", () => {
    mounted = mountComponent(<RetailSaleForm retail={view({})} onResult={vi.fn()} />);

    expect(findButtonByText(mounted.container, "Registrar venta").disabled).toBe(false);
  });
});
