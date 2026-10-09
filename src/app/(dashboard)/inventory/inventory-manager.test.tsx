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
import {
  createInventoryProductAction,
  deleteInventoryProductAction,
  transferInventoryStockAction,
} from "./actions";
import { InventoryManager } from "./inventory-manager";
import { SAVED_WITH_WARNINGS_MESSAGE } from "@/components/forms/use-submission-intent";
import { UUID_PATTERN, idempotencyKeyOf, settleSubmission } from "@/test/form-intent-dom";

vi.mock("./actions", () => ({
  createInventoryProductAction: vi.fn(),
  deleteInventoryProductAction: vi.fn(),
  transferInventoryStockAction: vi.fn(),
  updateInventoryProductAction: vi.fn(),
}));

const createMock = vi.mocked(createInventoryProductAction);
const deleteMock = vi.mocked(deleteInventoryProductAction);
const transferMock = vi.mocked(transferInventoryStockAction);

function inventoryView(): InventoryPageView {
  return { products: [], lowStock: [], recentMovements: [] } as InventoryPageView;
}

function banner(container: HTMLElement): HTMLElement | null {
  const box = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
    (element) => element.className.includes("border-success-border") || element.className.includes("border-danger-border")
  );
  return box ?? null;
}

describe("InventoryManager transferencias con intención idempotente", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("envía idempotency_key en la transferencia y la mantiene al reintentar tras un error", async () => {
    transferMock.mockReset();
    transferMock
      .mockResolvedValueOnce({ ok: false, error: "Stock insuficiente" })
      .mockResolvedValueOnce({ ok: true, value: "Stock transferido." });
    mounted = mountComponent(<InventoryManager inventory={inventoryView()} />);
    clickElement(findButtonByText(mounted.container, "Transferir stock"));
    const formElement = requireElement<HTMLFormElement>(mounted.container, "form");

    await submitFormAsync(formElement);
    await settleSubmission();
    await submitFormAsync(formElement);
    await settleSubmission();

    expect(transferMock).toHaveBeenCalledTimes(2);
    const firstKey = idempotencyKeyOf(transferMock.mock.calls[0]?.[1]);
    expect(firstKey).toMatch(UUID_PATTERN);
    expect(idempotencyKeyOf(transferMock.mock.calls[1]?.[1])).toBe(firstKey);
  });

  it("avisa cuando la transferencia se guardó pero un efecto posterior falló", async () => {
    transferMock.mockReset();
    transferMock.mockResolvedValueOnce({
      ok: true,
      value: "Stock transferido.",
      warnings: ["El movimiento no se registró en el historial."],
    } as Awaited<ReturnType<typeof transferInventoryStockAction>>);
    mounted = mountComponent(<InventoryManager inventory={inventoryView()} />);
    clickElement(findButtonByText(mounted.container, "Transferir stock"));

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await settleSubmission();

    expect(toast.warning).toHaveBeenCalledWith(SAVED_WITH_WARNINGS_MESSAGE);
  });
});

describe("InventoryManager", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    createMock.mockReset();
    deleteMock.mockReset();
    transferMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("abre en la pestaña Productos con las estadísticas y sin avisos", () => {
    mounted = mountComponent(<InventoryManager inventory={inventoryView()} />);

    expect(mounted.container.textContent).toContain("Bajos o agotados");
    expect(banner(mounted.container)).toBeNull();
  });

  it("crear un producto envía el formulario a la acción y muestra el resultado", async () => {
    createMock.mockResolvedValue({ ok: true, value: "Producto creado." });
    mounted = mountComponent(<InventoryManager inventory={inventoryView()} />);
    clickElement(findButtonByText(mounted.container, "Nuevo producto"));

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(banner(mounted.container)?.textContent).toBe("Producto creado.");
  });

  it("un error de la acción se muestra como aviso de error", async () => {
    createMock.mockResolvedValue({ ok: false, error: "El nombre ya existe" });
    mounted = mountComponent(<InventoryManager inventory={inventoryView()} />);
    clickElement(findButtonByText(mounted.container, "Nuevo producto"));

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(banner(mounted.container)?.textContent).toBe("El nombre ya existe");
    expect(banner(mounted.container)?.className).toContain("border-danger-border");
  });

  it("transferir stock envía el formulario a la acción de transferencia", async () => {
    transferMock.mockResolvedValue({ ok: true, value: "Stock transferido." });
    mounted = mountComponent(<InventoryManager inventory={inventoryView()} />);
    clickElement(findButtonByText(mounted.container, "Transferir stock"));

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(transferMock).toHaveBeenCalledTimes(1);
    expect(banner(mounted.container)?.textContent).toBe("Stock transferido.");
  });

  it("cambiar de pestaña limpia el aviso anterior", async () => {
    createMock.mockResolvedValue({ ok: true, value: "Producto creado." });
    mounted = mountComponent(<InventoryManager inventory={inventoryView()} />);
    clickElement(findButtonByText(mounted.container, "Nuevo producto"));
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();
    expect(banner(mounted.container)).not.toBeNull();

    clickElement(findButtonByText(mounted.container, "Movimientos"));

    expect(banner(mounted.container)).toBeNull();
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
