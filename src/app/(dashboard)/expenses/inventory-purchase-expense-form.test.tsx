// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { flushAsync, requireElement, setFieldValue, submitFormAsync } from "@/test/ui-shared-dom";
import { createInventoryPurchaseExpenseAction } from "./actions";
import { InventoryPurchaseExpenseForm } from "./inventory-purchase-expense-form";

vi.mock("./actions", () => ({
  createInventoryPurchaseExpenseAction: vi.fn(),
}));

const purchaseMock = vi.mocked(createInventoryPurchaseExpenseAction);

const PRODUCTS = [
  { id: "prod-1", name: "Tinte castaño" },
  { id: "prod-2", name: "Oxidante 20 vol" },
];

function field(container: HTMLElement, name: string): HTMLInputElement {
  return requireElement<HTMLInputElement>(container, `input[name="${name}"]`);
}

describe("InventoryPurchaseExpenseForm", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    purchaseMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("sin permiso de inventario explica el requisito y no muestra el formulario", () => {
    mounted = mountComponent(
      <InventoryPurchaseExpenseForm inventoryProducts={PRODUCTS} canManageInventory={false} onResult={vi.fn()} />
    );

    expect(mounted.container.querySelector("form")).toBeNull();
    expect(mounted.container.textContent).toContain("Necesitas permiso de inventario");
  });

  it("sin productos creados deshabilita el registro y pide crear uno primero", () => {
    mounted = mountComponent(
      <InventoryPurchaseExpenseForm inventoryProducts={[]} canManageInventory onResult={vi.fn()} />
    );

    const submit = mounted.container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBe(true);
    expect(mounted.container.textContent).toContain("Crea un producto en Inventario antes de registrar una compra.");
  });

  it("calcula el total de la compra a partir de cantidad y costo unitario", () => {
    mounted = mountComponent(
      <InventoryPurchaseExpenseForm inventoryProducts={PRODUCTS} canManageInventory onResult={vi.fn()} />
    );

    expect(mounted.container.textContent).toMatch(/Total de la compra:[\s\S]*0[.,]00/);

    setFieldValue(field(mounted.container, "quantity"), "3");
    setFieldValue(field(mounted.container, "unit_cost"), "12.5");

    expect(mounted.container.textContent).toMatch(/37[.,]50/);
  });

  it("el destino es siempre Bodega y no se elige en el formulario", () => {
    mounted = mountComponent(
      <InventoryPurchaseExpenseForm inventoryProducts={PRODUCTS} canManageInventory onResult={vi.fn()} />
    );

    expect(mounted.container.textContent).toContain("Destino automatico");
    expect(mounted.container.textContent).toContain("Bodega");
  });

  it("envía la compra a la acción y reporta el resultado al padre", async () => {
    purchaseMock.mockResolvedValue({ ok: true, value: "Compra registrada." });
    const onResult = vi.fn();
    mounted = mountComponent(
      <InventoryPurchaseExpenseForm inventoryProducts={PRODUCTS} canManageInventory onResult={onResult} />
    );

    setFieldValue(field(mounted.container, "quantity"), "2");
    setFieldValue(field(mounted.container, "unit_cost"), "8");
    setFieldValue(field(mounted.container, "supplier_name"), "Distribuidora Norte");
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(purchaseMock).toHaveBeenCalledTimes(1);
    const [, formData] = purchaseMock.mock.calls[0] ?? [];
    expect(formData?.get("quantity")).toBe("2");
    expect(formData?.get("unit_cost")).toBe("8");
    expect(formData?.get("supplier_name")).toBe("Distribuidora Norte");
    expect(onResult).toHaveBeenCalledWith({ ok: true, message: "Compra registrada." });
  });

  it("si la acción rechaza la compra, reporta el error al padre", async () => {
    purchaseMock.mockResolvedValue({ ok: false, error: "Stock insuficiente en origen" });
    const onResult = vi.fn();
    mounted = mountComponent(
      <InventoryPurchaseExpenseForm inventoryProducts={PRODUCTS} canManageInventory onResult={onResult} />
    );

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(onResult).toHaveBeenCalledWith({ ok: false, message: "Stock insuficiente en origen" });
  });
});
