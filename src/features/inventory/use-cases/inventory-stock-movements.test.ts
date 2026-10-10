import { describe, expect, it, vi } from "vitest";
import type { InventoryPurchaseInput, InventoryTransferInput } from "../schemas";
import {
  recordInventoryPurchase,
  transferInventoryStock,
  type InventoryMovementsDeps,
} from "./inventory-movements";

/** Fakes tipados de los adaptadores RPC de movimientos. */
function fakeDeps() {
  return {
    recordTransfer: vi.fn<InventoryMovementsDeps["recordTransfer"]>(async () => undefined),
    recordPurchase: vi.fn<InventoryMovementsDeps["recordPurchase"]>(async () => "purchase-1"),
  };
}

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
  describe("transferInventoryStock", () => {
    it("transfiere el stock dentro del salón con la clave y devuelve éxito", async () => {
      const deps = fakeDeps();

      expect(await transferInventoryStock(SALON_ID, transferInput, KEY, deps)).toEqual({
        ok: true,
        value: undefined,
      });
      expect(deps.recordTransfer).toHaveBeenCalledWith({
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
      const deps = fakeDeps();
      deps.recordTransfer.mockRejectedValue(new Error("stock insuficiente"));

      const result = await transferInventoryStock(SALON_ID, transferInput, KEY, deps);

      expect(result.ok).toBe(false);
      expect(result).toHaveProperty("error");
      expect(typeof (result as { error: unknown }).error).toBe("string");
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });
  });

  describe("recordInventoryPurchase", () => {
    it("registra la compra con la clave, sin ubicación y devuelve éxito", async () => {
      const deps = fakeDeps();

      expect(await recordInventoryPurchase(SALON_ID, purchaseInput, KEY, deps)).toEqual({
        ok: true,
        value: undefined,
      });
      expect(deps.recordPurchase).toHaveBeenCalledWith({
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
      const deps = fakeDeps();
      deps.recordPurchase.mockRejectedValue(new Error("fallo"));

      const result = await recordInventoryPurchase(SALON_ID, purchaseInput, KEY, deps);

      expect(result.ok).toBe(false);
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });
  });
});
