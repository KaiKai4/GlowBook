import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordInventoryPurchase,
  transferInventoryStock,
} from "./inventory-movements";
import { recordInventoryPurchaseRpc } from "../data/rpc/record-inventory-purchase";
import { recordInventoryTransferRpc } from "../data/rpc/record-inventory-transfer";

vi.mock("../data/rpc/record-inventory-purchase", () => ({
  recordInventoryPurchaseRpc: vi.fn(),
}));

vi.mock("../data/rpc/record-inventory-transfer", () => ({
  recordInventoryTransferRpc: vi.fn(),
}));

const KEY = "00000000-0000-4000-8000-0000000000c1";

const mockedTransfer = vi.mocked(recordInventoryTransferRpc);
const mockedPurchase = vi.mocked(recordInventoryPurchaseRpc);

describe("inventory movement use-cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra la transferencia con el adaptador RPC y reenvia la clave", async () => {
    mockedTransfer.mockResolvedValue(undefined);

    const result = await transferInventoryStock(
      "salon-1",
      {
        product_id: "product-1",
        from_location: "storage",
        to_location: "internal",
        quantity: 3,
        note: "Reposicion interna",
        idempotency_key: KEY,
      },
      KEY
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedTransfer).toHaveBeenCalledWith({
      salonId: "salon-1",
      productId: "product-1",
      fromLocation: "storage",
      toLocation: "internal",
      quantity: 3,
      note: "Reposicion interna",
      idempotencyKey: KEY,
    });
  });

  it("preserves our own RAISE messages (SQLSTATE P0001) when an atomic transfer fails", async () => {
    mockedTransfer.mockRejectedValue({ code: "P0001", message: "Stock insuficiente para completar la transferencia." });

    const result = await transferInventoryStock(
      "salon-1",
      {
        product_id: "product-1",
        from_location: "storage",
        to_location: "internal",
        quantity: 99,
        note: "",
        idempotency_key: KEY,
      },
      KEY
    );

    expect(result).toEqual({
      ok: false,
      error: "Stock insuficiente para completar la transferencia.",
    });
  });

  it("registra la compra con el adaptador RPC y reenvia la clave", async () => {
    mockedPurchase.mockResolvedValue("purchase-1");

    const result = await recordInventoryPurchase(
      "salon-1",
      {
        supplier_name: "Panafoto",
        purchase_date: "2026-06-03",
        product_id: "product-1",
        location: "storage",
        quantity: 5,
        unit_cost: 4,
        note: "Compra de prueba",
        idempotency_key: KEY,
      },
      KEY
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedPurchase).toHaveBeenCalledWith({
      salonId: "salon-1",
      supplierName: "Panafoto",
      purchaseDate: "2026-06-03",
      productId: "product-1",
      quantity: 5,
      unitCost: 4,
      note: "Compra de prueba",
      idempotencyKey: KEY,
    });
  });

  it("envia la misma clave en un reenvio del formulario de compra", async () => {
    mockedPurchase.mockResolvedValue("purchase-1");
    const input = {
      supplier_name: "",
      purchase_date: "2026-06-03",
      product_id: "product-1",
      location: "storage" as const,
      quantity: 5,
      unit_cost: 4,
      note: "",
      idempotency_key: KEY,
    };

    await recordInventoryPurchase("salon-1", input, KEY);
    await recordInventoryPurchase("salon-1", input, KEY);

    expect(mockedPurchase.mock.calls.map(([call]) => call.idempotencyKey)).toEqual([KEY, KEY]);
  });
});
