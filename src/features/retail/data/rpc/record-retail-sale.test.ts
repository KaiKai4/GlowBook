import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import { recordRetailSaleRpc, type RecordRetailSaleRpcInput } from "./record-retail-sale";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALE_ID = "00000000-0000-4000-8000-0000000000a1";
const KEY = "00000000-0000-4000-8000-0000000000c1";

const baseInput: RecordRetailSaleRpcInput = {
  salonId: "salon-1",
  customerId: null,
  productId: "product-1",
  location: "retail",
  quantity: 2,
  unitPrice: 12.5,
  paymentMethod: "cash",
  note: null,
  idempotencyKey: KEY,
};

function useDb(script: Parameters<typeof createSupabaseDouble>[0]): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("recordRetailSaleRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("envia el payload con la clave de idempotencia y devuelve el id de la venta", async () => {
    const db = useDb({ record_retail_sale: { data: SALE_ID, error: null } });

    expect(await recordRetailSaleRpc(baseInput)).toBe(SALE_ID);
    expect(db.operations).toContainEqual({
      target: "record_retail_sale",
      method: "rpc",
      args: [
        {
          p_salon_id: "salon-1",
          p_customer_id: null,
          p_product_id: "product-1",
          p_location: "retail",
          p_quantity: 2,
          p_unit_price: 12.5,
          p_payment_method: "cash",
          p_idempotency_key: KEY,
        },
      ],
    });
  });

  it("envia el cliente y la nota cuando vienen informados", async () => {
    const db = useDb({ record_retail_sale: { data: SALE_ID, error: null } });

    await recordRetailSaleRpc({ ...baseInput, customerId: "cust-1", note: "regalo" });

    expect(db.operations[0]?.args[0]).toMatchObject({ p_customer_id: "cust-1", p_note: "regalo" });
  });

  it("rechaza una respuesta que no es un uuid", async () => {
    useDb({ record_retail_sale: { data: 99, error: null } });

    await expect(recordRetailSaleRpc(baseInput)).rejects.toThrow(
      "Respuesta inesperada de la RPC record_retail_sale."
    );
  });

  it("propaga el error de la RPC sin transformarlo", async () => {
    const dbError = { message: "sin stock" };
    useDb({ record_retail_sale: { data: null, error: dbError } });

    await expect(recordRetailSaleRpc(baseInput)).rejects.toBe(dbError);
  });
});
