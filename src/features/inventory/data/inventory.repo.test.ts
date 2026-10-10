import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findInventoryProducts,
  findInventoryPurchaseHistory,
  findRecentInventoryMovements,
  softDeleteInventoryProduct,
} from "./inventory.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";
const PRODUCT_ID = "product-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("inventory.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("findInventoryProducts", () => {
    it("lista productos vigentes del salón con sus ubicaciones de stock", async () => {
      const db = useDb({ inventory_products: { data: [{ id: PRODUCT_ID }], error: null } });

      expect(await findInventoryProducts(SALON_ID)).toEqual([{ id: PRODUCT_ID }]);
      expect(operationsOn(db, "inventory_products")).toEqual([
        { target: "inventory_products", method: "select", args: ["*, inventory_stock_locations(*)"] },
        { target: "inventory_products", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "inventory_products", method: "is", args: ["deleted_at", null] },
        { target: "inventory_products", method: "order", args: ["name", { ascending: true }] },
      ]);
    });

    it("devuelve lista vacia sin datos y propaga errores", async () => {
      useDb({ inventory_products: { data: null, error: null } });
      expect(await findInventoryProducts(SALON_ID)).toEqual([]);

      const dbError = { message: "fallo" };
      useDb({ inventory_products: { data: null, error: dbError } });
      await expect(findInventoryProducts(SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("findRecentInventoryMovements", () => {
    it("trae los últimos movimientos del salón con límite por defecto de 8", async () => {
      const db = useDb({ inventory_movements: { data: [{ id: "m1" }], error: null } });

      expect(await findRecentInventoryMovements(SALON_ID)).toEqual([{ id: "m1" }]);
      expect(operationsOn(db, "inventory_movements")).toEqual([
        { target: "inventory_movements", method: "select", args: ["*, product:inventory_products(name)"] },
        { target: "inventory_movements", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "inventory_movements", method: "order", args: ["created_at", { ascending: false }] },
        { target: "inventory_movements", method: "limit", args: [8] },
      ]);
    });

    it("devuelve lista vacia sin datos y propaga errores", async () => {
      useDb({ inventory_movements: { data: null, error: null } });
      expect(await findRecentInventoryMovements(SALON_ID, 3)).toEqual([]);

      const dbError = { message: "fallo" };
      useDb({ inventory_movements: { data: null, error: dbError } });
      await expect(findRecentInventoryMovements(SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("softDeleteInventoryProduct", () => {
    it("el borrado logico desactiva el producto, marca fecha de borrado y filtra por salon", async () => {
      const db = useDb({ inventory_products: { data: null, error: null } });

      await softDeleteInventoryProduct(PRODUCT_ID, SALON_ID);

      const [update] = operationsOn(db, "inventory_products");
      expect(update?.method).toBe("update");
      expect(update?.args[0]).toEqual({
        is_active: false,
        deleted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
      expect(operationsOn(db, "inventory_products")).toContainEqual({
        target: "inventory_products",
        method: "eq",
        args: ["salon_id", SALON_ID],
      });
    });

    it("propaga errores de borrado logico", async () => {
      const deleteError = { message: "fallo" };
      useDb({ inventory_products: { data: null, error: deleteError } });
      await expect(softDeleteInventoryProduct(PRODUCT_ID, SALON_ID)).rejects.toBe(deleteError);
    });
  });

  describe("findInventoryPurchaseHistory", () => {
    it("trae el historial de compras del salón ordenado y limitado a 80 por defecto", async () => {
      const db = useDb({ inventory_purchases: { data: [{ id: "c1" }], error: null } });

      expect(await findInventoryPurchaseHistory(SALON_ID)).toEqual([{ id: "c1" }]);
      expect(operationsOn(db, "inventory_purchases")).toEqual([
        expect.objectContaining({ method: "select" }),
        { target: "inventory_purchases", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "inventory_purchases", method: "order", args: ["purchase_date", { ascending: false }] },
        { target: "inventory_purchases", method: "order", args: ["created_at", { ascending: false }] },
        { target: "inventory_purchases", method: "limit", args: [80] },
      ]);
    });

    it("devuelve lista vacia sin datos y propaga errores", async () => {
      useDb({ inventory_purchases: { data: null, error: null } });
      expect(await findInventoryPurchaseHistory(SALON_ID, 1)).toEqual([]);

      const dbError = { message: "fallo" };
      useDb({ inventory_purchases: { data: null, error: dbError } });
      await expect(findInventoryPurchaseHistory(SALON_ID)).rejects.toBe(dbError);
    });
  });
});
