import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordInventoryPurchaseAtomically,
  sumInventoryPurchasesTotal,
  transferInventoryStockAtomically,
} from "../data/inventory.repo";
import type { InventoryPurchaseInput, InventoryTransferInput } from "../schemas";
import { getInventoryPurchaseTotal } from "./inventory-purchase-total";
import { recordInventoryPurchase, transferInventoryStock } from "./inventory-movements";

vi.mock("../data/inventory.repo", () => ({
  recordInventoryPurchaseAtomically: vi.fn(),
  sumInventoryPurchasesTotal: vi.fn(),
  transferInventoryStockAtomically: vi.fn(),
}));

const mockedRecordPurchase = vi.mocked(recordInventoryPurchaseAtomically);
const mockedSumPurchases = vi.mocked(sumInventoryPurchasesTotal);
const mockedTransfer = vi.mocked(transferInventoryStockAtomically);

const SALON_ID = "salon-1";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000033";

const transferInput: InventoryTransferInput = {
  product_id: PRODUCT_ID,
  from_location: "storage",
  to_location: "retail",
  quantity: 3,
  note: "reposicion",
};

const purchaseInput: InventoryPurchaseInput = {
  supplier_name: "Distribuidora",
  purchase_date: "2026-06-10",
  product_id: PRODUCT_ID,
  location: "storage",
  quantity: 6,
  unit_cost: 2.5,
  note: "",
};

describe("movimientos de inventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transferInventoryStock", () => {
    it("transfiere el stock dentro del salon y devuelve exito", async () => {
      mockedTransfer.mockResolvedValue(undefined);

      expect(await transferInventoryStock(SALON_ID, transferInput)).toEqual({ ok: true, value: undefined });
      expect(mockedTransfer).toHaveBeenCalledWith(SALON_ID, transferInput);
    });

    it("devuelve error con texto no vacio cuando la transferencia falla", async () => {
      mockedTransfer.mockRejectedValue(new Error("stock insuficiente"));

      const result = await transferInventoryStock(SALON_ID, transferInput);

      expect(result.ok).toBe(false);
      expect(result).toHaveProperty("error");
      expect(typeof (result as { error: unknown }).error).toBe("string");
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });
  });

  describe("recordInventoryPurchase", () => {
    it("registra la compra con los campos de reposicion (sin ubicacion) y devuelve exito", async () => {
      mockedRecordPurchase.mockResolvedValue({ id: "purchase-1" });

      expect(await recordInventoryPurchase(SALON_ID, purchaseInput)).toEqual({ ok: true, value: undefined });
      expect(mockedRecordPurchase).toHaveBeenCalledWith(SALON_ID, {
        supplier_name: "Distribuidora",
        purchase_date: "2026-06-10",
        product_id: PRODUCT_ID,
        quantity: 6,
        unit_cost: 2.5,
        note: "",
      });
    });

    it("devuelve error con texto no vacio cuando el registro falla", async () => {
      mockedRecordPurchase.mockRejectedValue(new Error("fallo"));

      const result = await recordInventoryPurchase(SALON_ID, purchaseInput);

      expect(result.ok).toBe(false);
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });
  });

  describe("getInventoryPurchaseTotal", () => {
    it("delega el total de compras del rango al repositorio del salon", async () => {
      mockedSumPurchases.mockResolvedValue(123.5);

      expect(await getInventoryPurchaseTotal(SALON_ID, "2026-06-01", "2026-06-30")).toBe(123.5);
      expect(mockedSumPurchases).toHaveBeenCalledWith(SALON_ID, "2026-06-01", "2026-06-30");
    });
  });
});
