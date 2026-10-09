import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findRecentRetailSales,
  recordRetailSaleAtomically,
  sumRetailSalesTotal,
} from "./retail.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("retail.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("recordRetailSaleAtomically", () => {
    it("registra la venta con la RPC normalizando cliente y nota vacios a null", async () => {
      const db = useDb({ record_retail_sale: { data: 99, error: null } });

      expect(
        await recordRetailSaleAtomically(SALON_ID, {
          customer_id: "",
          product_id: "product-1",
          location: "retail",
          quantity: 2,
          unit_price: 12.5,
          payment_method: "cash",
          note: "",
        })
      ).toEqual({ id: "99" });
      expect(db.operations).toContainEqual({
        target: "record_retail_sale",
        method: "rpc",
        args: [
          {
            p_salon_id: SALON_ID,
            p_customer_id: null,
            p_product_id: "product-1",
            p_location: "retail",
            p_quantity: 2,
            p_unit_price: 12.5,
            p_payment_method: "cash",
            p_note: null,
          },
        ],
      });
    });

    it("envia el cliente y la nota cuando vienen informados", async () => {
      const db = useDb({ record_retail_sale: { data: "sale-1", error: null } });

      await recordRetailSaleAtomically(SALON_ID, {
        customer_id: "cust-1",
        product_id: "product-1",
        location: "storage",
        quantity: 1,
        unit_price: 5,
        payment_method: "card",
        note: "regalo",
      });

      expect(db.operations[0]?.args[0]).toMatchObject({ p_customer_id: "cust-1", p_note: "regalo" });
    });

    it("propaga el error de la RPC", async () => {
      const dbError = { message: "sin stock" };
      useDb({ record_retail_sale: { data: null, error: dbError } });

      await expect(
        recordRetailSaleAtomically(SALON_ID, {
          product_id: "product-1",
          location: "retail",
          quantity: 1,
          unit_price: 1,
          payment_method: "cash",
        })
      ).rejects.toBe(dbError);
    });
  });

  describe("findRecentRetailSales", () => {
    it("lista las ventas recientes del salon con cliente y limite por defecto de 8", async () => {
      const db = useDb({ retail_sales: { data: [{ id: "s1" }], error: null } });

      expect(await findRecentRetailSales(SALON_ID)).toEqual([{ id: "s1" }]);
      expect(operationsOn(db, "retail_sales")).toEqual([
        {
          target: "retail_sales",
          method: "select",
          args: ["id, sale_date, total_amount, payment_method, note, customer:customers(first_name, last_name)"],
        },
        { target: "retail_sales", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "retail_sales", method: "order", args: ["sale_date", { ascending: false }] },
        { target: "retail_sales", method: "limit", args: [8] },
      ]);
    });

    it("devuelve lista vacia sin datos y propaga errores", async () => {
      useDb({ retail_sales: { data: null, error: null } });
      expect(await findRecentRetailSales(SALON_ID)).toEqual([]);

      const dbError = { message: "fallo" };
      useDb({ retail_sales: { data: null, error: dbError } });
      await expect(findRecentRetailSales(SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("sumRetailSalesTotal", () => {
    it("suma los importes de ventas del rango con filtro de salon", async () => {
      const db = useDb({ retail_sales: { data: [{ total_amount: 20 }, { total_amount: "5.25" }, { total_amount: null }], error: null } });

      expect(await sumRetailSalesTotal(SALON_ID, "2026-06-01T00:00:00Z", "2026-06-30T23:59:59Z")).toBe(25.25);
      expect(operationsOn(db, "retail_sales")).toEqual([
        { target: "retail_sales", method: "select", args: ["total_amount"] },
        { target: "retail_sales", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "retail_sales", method: "gte", args: ["sale_date", "2026-06-01T00:00:00Z"] },
        { target: "retail_sales", method: "lte", args: ["sale_date", "2026-06-30T23:59:59Z"] },
      ]);
    });

    it("devuelve cero sin filas y propaga errores", async () => {
      useDb({ retail_sales: { data: null, error: null } });
      expect(await sumRetailSalesTotal(SALON_ID, "a", "b")).toBe(0);

      const dbError = { message: "fallo" };
      useDb({ retail_sales: { data: null, error: dbError } });
      await expect(sumRetailSalesTotal(SALON_ID, "a", "b")).rejects.toBe(dbError);
    });
  });
});
