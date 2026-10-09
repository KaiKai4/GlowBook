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
  insertInventoryMovement,
  insertInventoryProduct,
  insertStockLocations,
  softDeleteInventoryProduct,
  sumInventoryPurchasesTotal,
  updateInventoryProduct,
  updateStockMinimums,
} from "./inventory.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
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
    it("lista productos vigentes del salon con sus ubicaciones de stock", async () => {
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
    it("trae los ultimos movimientos del salon con limite por defecto de 8", async () => {
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

  describe("insertInventoryProduct", () => {
    it("inserta el producto del salon con categoria nula cuando viene vacia", async () => {
      const db = useDb({ inventory_products: { data: { id: PRODUCT_ID }, error: null } });

      expect(
        await insertInventoryProduct(SALON_ID, {
          name: "Tinte",
          category: "",
          cost_price: 4,
          sale_price: 9,
          is_retail_enabled: true,
        })
      ).toEqual({ id: PRODUCT_ID });
      expect(operationsOn(db, "inventory_products")).toContainEqual({
        target: "inventory_products",
        method: "insert",
        args: [
          {
            salon_id: SALON_ID,
            name: "Tinte",
            category: null,
            cost_price: 4,
            sale_price: 9,
            is_retail_enabled: true,
          },
        ],
      });
    });

    it("propaga el error de insercion", async () => {
      const dbError = { message: "fallo" };
      useDb({ inventory_products: { data: null, error: dbError } });

      await expect(
        insertInventoryProduct(SALON_ID, {
          name: "Tinte",
          cost_price: 4,
          sale_price: 9,
          is_retail_enabled: false,
        })
      ).rejects.toBe(dbError);
    });
  });

  describe("updateInventoryProduct / softDeleteInventoryProduct", () => {
    it("actualiza el producto solo dentro del salon y guarda categoria nula si viene vacia", async () => {
      const db = useDb({ inventory_products: { data: null, error: null } });

      await updateInventoryProduct(PRODUCT_ID, SALON_ID, {
        name: "Tinte",
        category: undefined,
        cost_price: 4,
        sale_price: 9,
        is_retail_enabled: false,
        is_active: true,
      });

      expect(operationsOn(db, "inventory_products")).toEqual([
        {
          target: "inventory_products",
          method: "update",
          args: [
            {
              name: "Tinte",
              category: null,
              cost_price: 4,
              sale_price: 9,
              is_retail_enabled: false,
              is_active: true,
            },
          ],
        },
        { target: "inventory_products", method: "eq", args: ["id", PRODUCT_ID] },
        { target: "inventory_products", method: "eq", args: ["salon_id", SALON_ID] },
      ]);
    });

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

    it("propaga errores de actualizacion y de borrado logico", async () => {
      const updateError = { message: "fallo" };
      useDb({ inventory_products: { data: null, error: updateError } });
      await expect(
        updateInventoryProduct(PRODUCT_ID, SALON_ID, {
          name: "x",
          cost_price: 1,
          sale_price: 2,
          is_retail_enabled: false,
          is_active: true,
        })
      ).rejects.toBe(updateError);

      const deleteError = { message: "fallo" };
      useDb({ inventory_products: { data: null, error: deleteError } });
      await expect(softDeleteInventoryProduct(PRODUCT_ID, SALON_ID)).rejects.toBe(deleteError);
    });
  });

  describe("insertStockLocations", () => {
    it("inserta una fila por ubicacion con salon y producto y devuelve las filas creadas", async () => {
      const db = useDb({ inventory_stock_locations: { data: [{ id: "s1" }], error: null } });

      expect(
        await insertStockLocations(SALON_ID, PRODUCT_ID, [
          { location: "retail", quantity: 3, minimum_quantity: 1 },
        ])
      ).toEqual([{ id: "s1" }]);
      expect(operationsOn(db, "inventory_stock_locations")).toEqual([
        {
          target: "inventory_stock_locations",
          method: "insert",
          args: [
            [
              {
                location: "retail",
                quantity: 3,
                minimum_quantity: 1,
                salon_id: SALON_ID,
                product_id: PRODUCT_ID,
              },
            ],
          ],
        },
        { target: "inventory_stock_locations", method: "select", args: [] },
      ]);
    });

    it("devuelve lista vacia sin datos y propaga errores", async () => {
      useDb({ inventory_stock_locations: { data: null, error: null } });
      expect(await insertStockLocations(SALON_ID, PRODUCT_ID, [])).toEqual([]);

      const dbError = { message: "fallo" };
      useDb({ inventory_stock_locations: { data: null, error: dbError } });
      await expect(
        insertStockLocations(SALON_ID, PRODUCT_ID, [{ location: "storage", quantity: 1, minimum_quantity: 0 }])
      ).rejects.toBe(dbError);
    });
  });

  describe("updateStockMinimums", () => {
    it("actualiza el minimo de cada ubicacion del producto dentro del salon", async () => {
      const db = useDb({ inventory_stock_locations: [{ data: null, error: null }, { data: null, error: null }] });

      await updateStockMinimums(SALON_ID, PRODUCT_ID, [
        { location: "retail", minimum_quantity: 2 },
        { location: "storage", minimum_quantity: 5 },
      ]);

      const updates = operationsOn(db, "inventory_stock_locations").filter((op) => op.method === "update");
      expect(updates.map((op) => op.args)).toEqual([[{ minimum_quantity: 2 }], [{ minimum_quantity: 5 }]]);
      expect(operationsOn(db, "inventory_stock_locations")).toContainEqual({
        target: "inventory_stock_locations",
        method: "eq",
        args: ["location", "storage"],
      });
    });

    it("se detiene en la primera ubicacion con error", async () => {
      const dbError = { message: "fallo" };
      const db = useDb({
        inventory_stock_locations: [{ data: null, error: dbError }, { data: null, error: null }],
      });

      await expect(
        updateStockMinimums(SALON_ID, PRODUCT_ID, [
          { location: "retail", minimum_quantity: 2 },
          { location: "storage", minimum_quantity: 5 },
        ])
      ).rejects.toBe(dbError);
      expect(operationsOn(db, "inventory_stock_locations").filter((op) => op.method === "update")).toHaveLength(1);
    });
  });

  describe("insertInventoryMovement", () => {
    it("registra el movimiento con referencias y nota nulas cuando no se indican", async () => {
      const db = useDb({ inventory_movements: { data: null, error: null } });

      await insertInventoryMovement(SALON_ID, {
        product_id: PRODUCT_ID,
        location: "retail",
        movement_type: "sale",
        quantity_delta: -1,
        quantity_after: 4,
      });

      expect(operationsOn(db, "inventory_movements")).toEqual([
        {
          target: "inventory_movements",
          method: "insert",
          args: [
            {
              salon_id: SALON_ID,
              product_id: PRODUCT_ID,
              location: "retail",
              movement_type: "sale",
              quantity_delta: -1,
              quantity_after: 4,
              reference_type: null,
              reference_id: null,
              note: null,
            },
          ],
        },
      ]);
    });

    it("propaga el error de insercion", async () => {
      const dbError = { message: "fallo" };
      useDb({ inventory_movements: { data: null, error: dbError } });

      await expect(
        insertInventoryMovement(SALON_ID, {
          product_id: PRODUCT_ID,
          location: "storage",
          movement_type: "adjust",
          quantity_delta: 1,
          quantity_after: 1,
        })
      ).rejects.toBe(dbError);
    });
  });

  describe("sumInventoryPurchasesTotal", () => {
    it("suma el costo total de las compras del rango con filtro de salon", async () => {
      const db = useDb({ inventory_purchases: { data: [{ total_cost: 10 }, { total_cost: "7.5" }, { total_cost: null }], error: null } });

      expect(await sumInventoryPurchasesTotal(SALON_ID, "2026-06-01", "2026-06-30")).toBe(17.5);
      expect(operationsOn(db, "inventory_purchases")).toEqual([
        { target: "inventory_purchases", method: "select", args: ["total_cost"] },
        { target: "inventory_purchases", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "inventory_purchases", method: "gte", args: ["purchase_date", "2026-06-01"] },
        { target: "inventory_purchases", method: "lte", args: ["purchase_date", "2026-06-30"] },
      ]);
    });

    it("devuelve cero sin filas y propaga errores", async () => {
      useDb({ inventory_purchases: { data: null, error: null } });
      expect(await sumInventoryPurchasesTotal(SALON_ID, "2026-06-01", "2026-06-30")).toBe(0);

      const dbError = { message: "fallo" };
      useDb({ inventory_purchases: { data: null, error: dbError } });
      await expect(sumInventoryPurchasesTotal(SALON_ID, "2026-06-01", "2026-06-30")).rejects.toBe(dbError);
    });
  });

  describe("findInventoryPurchaseHistory", () => {
    it("trae el historial de compras del salon ordenado y limitado a 80 por defecto", async () => {
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
