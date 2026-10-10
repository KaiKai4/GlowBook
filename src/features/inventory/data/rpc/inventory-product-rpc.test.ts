import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import {
  createInventoryProductWithStockRpc,
  updateInventoryProductProfileRpc,
  type CreateInventoryProductRpcInput,
  type UpdateInventoryProductRpcInput,
} from "./inventory-product-rpc";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const PRODUCT_ID = "00000000-0000-4000-8000-0000000000d1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0]): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

const createInput: CreateInventoryProductRpcInput = {
  salonId: "salon-1",
  name: "Tinte",
  category: null,
  costPrice: 4,
  salePrice: 9,
  isRetailEnabled: true,
  retailQuantity: 2,
  retailMinimum: 1,
  internalQuantity: 0,
  internalMinimum: 0,
  storageQuantity: 5,
  storageMinimum: 3,
};

const updateInput: UpdateInventoryProductRpcInput = {
  salonId: "salon-1",
  productId: PRODUCT_ID,
  name: "Tinte",
  category: "Color",
  costPrice: 4,
  salePrice: 9,
  isRetailEnabled: false,
  isActive: true,
  retailMinimum: 1,
  internalMinimum: 2,
  storageMinimum: 3,
};

describe("createInventoryProductWithStockRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("invoca la RPC con el salon, las cantidades por ubicacion y categoria nula si viene vacia", async () => {
    const db = useDb({ create_inventory_product_with_stock: { data: PRODUCT_ID, error: null } });

    expect(await createInventoryProductWithStockRpc(createInput)).toBe(PRODUCT_ID);

    expect(db.operations).toContainEqual({
      target: "create_inventory_product_with_stock",
      method: "rpc",
      args: [
        {
          p_salon_id: "salon-1",
          p_name: "Tinte",
          p_category: "",
          p_cost_price: 4,
          p_sale_price: 9,
          p_is_retail_enabled: true,
          p_retail_quantity: 2,
          p_retail_minimum: 1,
          p_internal_quantity: 0,
          p_internal_minimum: 0,
          p_storage_quantity: 5,
          p_storage_minimum: 3,
        },
      ],
    });
  });

  it("rechaza una respuesta que no sea un uuid", async () => {
    useDb({ create_inventory_product_with_stock: { data: "no-es-uuid", error: null } });

    await expect(createInventoryProductWithStockRpc(createInput)).rejects.toThrow();
  });

  it("propaga el error de la RPC sin transformarlo", async () => {
    const dbError = { message: "duplicate", code: "23505" };
    useDb({ create_inventory_product_with_stock: { data: null, error: dbError } });

    await expect(createInventoryProductWithStockRpc(createInput)).rejects.toBe(dbError);
  });
});

describe("updateInventoryProductProfileRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("invoca la RPC con el producto, el salon y los minimos de cada ubicacion", async () => {
    const db = useDb({ update_inventory_product_profile: { data: null, error: null } });

    await updateInventoryProductProfileRpc(updateInput);

    expect(db.operations).toContainEqual({
      target: "update_inventory_product_profile",
      method: "rpc",
      args: [
        {
          p_salon_id: "salon-1",
          p_product_id: PRODUCT_ID,
          p_name: "Tinte",
          p_category: "Color",
          p_cost_price: 4,
          p_sale_price: 9,
          p_is_retail_enabled: false,
          p_is_active: true,
          p_retail_minimum: 1,
          p_internal_minimum: 2,
          p_storage_minimum: 3,
        },
      ],
    });
  });

  it("propaga el error de la RPC", async () => {
    const dbError = { message: "P0002" };
    useDb({ update_inventory_product_profile: { data: null, error: dbError } });

    await expect(updateInventoryProductProfileRpc(updateInput)).rejects.toBe(dbError);
  });
});
