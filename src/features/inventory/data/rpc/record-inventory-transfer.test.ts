import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import { recordInventoryTransferRpc } from "./record-inventory-transfer";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const KEY = "00000000-0000-4000-8000-0000000000c1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0]): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("recordInventoryTransferRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("invoca la RPC con el salón, la clave y nota nula si viene vacia", async () => {
    const db = useDb({ record_inventory_transfer: { data: null, error: null } });

    await recordInventoryTransferRpc({
      salonId: "salon-1",
      productId: "product-1",
      fromLocation: "storage",
      toLocation: "retail",
      quantity: 2,
      note: null,
      idempotencyKey: KEY,
    });

    expect(db.operations).toContainEqual({
      target: "record_inventory_transfer",
      method: "rpc",
      args: [
        {
          p_salon_id: "salon-1",
          p_product_id: "product-1",
          p_from_location: "storage",
          p_to_location: "retail",
          p_quantity: 2,
          p_idempotency_key: KEY,
        },
      ],
    });
  });

  it("propaga el error de la RPC sin transformarlo", async () => {
    const dbError = { message: "stock insuficiente" };
    useDb({ record_inventory_transfer: { data: null, error: dbError } });

    await expect(
      recordInventoryTransferRpc({
        salonId: "salon-1",
        productId: "product-1",
        fromLocation: "storage",
        toLocation: "retail",
        quantity: 99,
        note: null,
        idempotencyKey: KEY,
      })
    ).rejects.toBe(dbError);
  });
});
