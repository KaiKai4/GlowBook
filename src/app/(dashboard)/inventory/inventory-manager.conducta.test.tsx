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
import type { InventoryPageView } from "@/features/inventory/use-cases/inventory-products";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, flushAsync, requireElement, submitFormAsync } from "@/test/ui-shared-dom";
import { deleteInventoryProductAction, updateInventoryProductAction } from "./actions";
import { InventoryManager } from "./inventory-manager";

vi.mock("./actions", () => ({
  createInventoryProductAction: vi.fn(),
  deleteInventoryProductAction: vi.fn(),
  transferInventoryStockAction: vi.fn(),
  updateInventoryProductAction: vi.fn(),
}));

const updateMock = vi.mocked(updateInventoryProductAction);
const deleteMock = vi.mocked(deleteInventoryProductAction);

function inventoryWithProduct(): InventoryPageView {
  return {
    products: [
      {
        id: "prod-7",
        name: "Tinte castaño",
        category: "Color",
        costPrice: 8,
        salePrice: 0,
        isRetailEnabled: false,
        isActive: true,
        totalQuantity: 3,
        stock: [{ location: "internal", label: "Uso interno", quantity: 3, minimumQuantity: 1, status: "ok" }],
      },
    ],
    lowStock: [],
    recentMovements: [],
  } as InventoryPageView;
}

function banner(container: HTMLElement): HTMLElement | null {
  const box = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
    (element) => element.className.includes("border-success-border") || element.className.includes("border-danger-border")
  );
  return box ?? null;
}

describe("InventoryManager (acciones sobre productos)", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("guardar la edición de un producto llama a la acción con su id y muestra el resultado", async () => {
    updateMock.mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<InventoryManager inventory={inventoryWithProduct()} />);
    clickElement(findButtonByText(mounted.container, "Editar producto"));

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]?.[0]).toBe("prod-7");
    // La acción de edición no devuelve texto: el padre muestra el mensaje genérico.
    expect(banner(mounted.container)?.textContent).toBe("Cambios guardados.");
  });

  it("eliminar un producto tras confirmar llama a la acción con su id", async () => {
    deleteMock.mockResolvedValue({ ok: true, value: "Producto eliminado." });
    mounted = mountComponent(<InventoryManager inventory={inventoryWithProduct()} />);
    clickElement(findButtonByText(mounted.container, "Editar producto"));

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));
    clickElement(findButtonByText(mounted.container, "Confirmar eliminar"));
    await flushAsync();

    expect(deleteMock).toHaveBeenCalledWith("prod-7");
    expect(banner(mounted.container)?.textContent).toBe("Producto eliminado.");
  });

  it("si eliminar falla muestra el motivo como aviso de error", async () => {
    deleteMock.mockResolvedValue({ ok: false, error: "El producto tiene movimientos recientes" });
    mounted = mountComponent(<InventoryManager inventory={inventoryWithProduct()} />);
    clickElement(findButtonByText(mounted.container, "Editar producto"));

    clickElement(findButtonByText(mounted.container, "Eliminar producto"));
    clickElement(findButtonByText(mounted.container, "Confirmar eliminar"));
    await flushAsync();

    expect(banner(mounted.container)?.textContent).toBe("El producto tiene movimientos recientes");
    expect(banner(mounted.container)?.className).toContain("border-danger-border");
  });
});
