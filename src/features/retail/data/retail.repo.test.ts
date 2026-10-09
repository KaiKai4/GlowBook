import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import { findRecentRetailSales } from "./retail.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
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

});
