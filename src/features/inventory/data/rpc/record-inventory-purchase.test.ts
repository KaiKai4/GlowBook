import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import { recordInventoryPurchaseRpc, type RecordInventoryPurchaseRpcInput } from "./record-inventory-purchase";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const PURCHASE_ID = "00000000-0000-4000-8000-0000000000a2";
const KEY = "00000000-0000-4000-8000-0000000000c1";

const baseInput: RecordInventoryPurchaseRpcInput = {
  salonId: "salon-1",
  supplierName: null,
  purchaseDate: "2026-06-10",
  productId: "product-1",
  quantity: 3,
  unitCost: 5,
  note: "lote",
  idempotencyKey: KEY,
};

function useDb(script: Parameters<typeof createSupabaseDouble>[0]): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("recordInventoryPurchaseRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("registra la compra con la clave y devuelve el id de la compra", async () => {
    const db = useDb({ record_inventory_purchase: { data: PURCHASE_ID, error: null } });

    expect(await recordInventoryPurchaseRpc(baseInput)).toBe(PURCHASE_ID);
    expect(db.operations).toContainEqual({
      target: "record_inventory_purchase",
      method: "rpc",
      args: [
        {
          p_salon_id: "salon-1",
          p_supplier_name: null,
          p_purchase_date: "2026-06-10",
          p_product_id: "product-1",
          p_quantity: 3,
          p_unit_cost: 5,
          p_note: "lote",
          p_idempotency_key: KEY,
        },
      ],
    });
  });

  it("rechaza una respuesta que no es un uuid", async () => {
    useDb({ record_inventory_purchase: { data: 42, error: null } });

    await expect(recordInventoryPurchaseRpc(baseInput)).rejects.toThrow(
      "Respuesta inesperada de la RPC record_inventory_purchase."
    );
  });

  it("propaga el error de la RPC sin transformarlo", async () => {
    const dbError = { message: "fallo" };
    useDb({ record_inventory_purchase: { data: null, error: dbError } });

    await expect(recordInventoryPurchaseRpc(baseInput)).rejects.toBe(dbError);
  });
});
