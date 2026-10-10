import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordInventoryPurchaseRpc } from "../data/rpc/record-inventory-purchase";
import { recordInventoryTransferRpc } from "../data/rpc/record-inventory-transfer";
import type { InventoryPurchaseInput, InventoryTransferInput } from "../schemas";
import { recordInventoryPurchase, transferInventoryStock } from "./inventory-movements";

vi.mock("../data/rpc/record-inventory-purchase", () => ({
  recordInventoryPurchaseRpc: vi.fn(),
}));

vi.mock("../data/rpc/record-inventory-transfer", () => ({
  recordInventoryTransferRpc: vi.fn(),
}));

const mockedRecordPurchase = vi.mocked(recordInventoryPurchaseRpc);
const mockedTransfer = vi.mocked(recordInventoryTransferRpc);

const SALON_ID = "salon-1";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000033";
const KEY = "00000000-0000-4000-8000-0000000000c1";

const transferInput: InventoryTransferInput = {
  product_id: PRODUCT_ID,
  from_location: "storage",
  to_location: "retail",
  quantity: 3,
  note: "reposicion",
  idempotency_key: KEY,
};

const purchaseInput: InventoryPurchaseInput = {
  supplier_name: "Distribuidora",
  purchase_date: "2026-06-10",
  product_id: PRODUCT_ID,
  location: "storage",
  quantity: 6,
  unit_cost: 2.5,
  note: "",
  idempotency_key: KEY,
};

describe("movimientos de inventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transferInventoryStock", () => {
    it("transfiere el stock dentro del salón con la clave y devuelve éxito", async () => {
      mockedTransfer.mockResolvedValue(undefined);

      expect(await transferInventoryStock(SALON_ID, transferInput, KEY)).toEqual({
        ok: true,
        value: undefined,
      });
      expect(mockedTransfer).toHaveBeenCalledWith({
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        fromLocation: "storage",
        toLocation: "retail",
        quantity: 3,
        note: "reposicion",
        idempotencyKey: KEY,
      });
    });

    it("devuelve error con texto no vacio cuando la transferencia falla", async () => {
      mockedTransfer.mockRejectedValue(new Error("stock insuficiente"));

      const result = await transferInventoryStock(SALON_ID, transferInput, KEY);

      expect(result.ok).toBe(false);
      expect(result).toHaveProperty("error");
      expect(typeof (result as { error: unknown }).error).toBe("string");
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });
  });

  describe("recordInventoryPurchase", () => {
    it("registra la compra con la clave, sin ubicación y devuelve éxito", async () => {
      mockedRecordPurchase.mockResolvedValue("purchase-1");

      expect(await recordInventoryPurchase(SALON_ID, purchaseInput, KEY)).toEqual({
        ok: true,
        value: undefined,
      });
      expect(mockedRecordPurchase).toHaveBeenCalledWith({
        salonId: SALON_ID,
        supplierName: "Distribuidora",
        purchaseDate: "2026-06-10",
        productId: PRODUCT_ID,
        quantity: 6,
        unitCost: 2.5,
        note: null,
        idempotencyKey: KEY,
      });
    });

    it("devuelve error con texto no vacio cuando el registro falla", async () => {
      mockedRecordPurchase.mockRejectedValue(new Error("fallo"));

      const result = await recordInventoryPurchase(SALON_ID, purchaseInput, KEY);

      expect(result.ok).toBe(false);
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });
  });

});
