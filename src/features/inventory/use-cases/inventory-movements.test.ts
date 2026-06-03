import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordInventoryMovement,
  recordInventoryPurchase,
  transferInventoryStock,
} from "./inventory-movements";
import {
  recordInventoryPurchaseAtomically,
  transferInventoryStockAtomically,
} from "../data/inventory.repo";
import { adjustInventoryStock } from "./stock-commands";

vi.mock("../data/inventory.repo", () => ({
  recordInventoryPurchaseAtomically: vi.fn(),
  transferInventoryStockAtomically: vi.fn(),
}));

vi.mock("./stock-commands", () => ({
  adjustInventoryStock: vi.fn(),
}));

const mockedTransfer = vi.mocked(transferInventoryStockAtomically);
const mockedPurchase = vi.mocked(recordInventoryPurchaseAtomically);
const mockedAdjustStock = vi.mocked(adjustInventoryStock);

describe("inventory movement use-cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers transfers through the atomic inventory transfer adapter", async () => {
    mockedTransfer.mockResolvedValue(undefined);

    const result = await transferInventoryStock("salon-1", {
      product_id: "product-1",
      from_location: "storage",
      to_location: "internal",
      quantity: 3,
      note: "Reposicion interna",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedTransfer).toHaveBeenCalledWith("salon-1", {
      product_id: "product-1",
      from_location: "storage",
      to_location: "internal",
      quantity: 3,
      note: "Reposicion interna",
    });
  });

  it("preserves database error messages when an atomic transfer fails", async () => {
    mockedTransfer.mockRejectedValue({ message: "Stock insuficiente para completar la transferencia." });

    const result = await transferInventoryStock("salon-1", {
      product_id: "product-1",
      from_location: "storage",
      to_location: "internal",
      quantity: 99,
      note: "",
    });

    expect(result).toEqual({
      ok: false,
      error: "Stock insuficiente para completar la transferencia.",
    });
  });

  it("registers inventory purchases through the atomic purchase adapter", async () => {
    mockedPurchase.mockResolvedValue({ id: "purchase-1" });

    const result = await recordInventoryPurchase("salon-1", {
      supplier_name: "Panafoto",
      purchase_date: "2026-06-03",
      product_id: "product-1",
      location: "storage",
      quantity: 5,
      unit_cost: 4,
      note: "Compra de prueba",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedPurchase).toHaveBeenCalledWith("salon-1", {
      supplier_name: "Panafoto",
      purchase_date: "2026-06-03",
      product_id: "product-1",
      quantity: 5,
      unit_cost: 4,
      note: "Compra de prueba",
    });
  });

  it("keeps one-step manual movements behind the stock delta adapter", async () => {
    mockedAdjustStock.mockResolvedValue({ ok: true, value: { quantityAfter: 8 } });

    const result = await recordInventoryMovement("salon-1", {
      product_id: "product-1",
      location: "internal",
      movement_kind: "internal_use",
      quantity: 2,
      note: "Uso en servicio",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedAdjustStock).toHaveBeenCalledWith({
      salonId: "salon-1",
      productId: "product-1",
      location: "internal",
      delta: -2,
      movementType: "internal_use",
      note: "Uso en servicio",
    });
  });
});
