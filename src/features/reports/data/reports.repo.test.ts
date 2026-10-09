import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findHistoricalReportRows,
  findSalonReportIdentity,
  findSalonTimezone,
} from "./reports.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";
const RANGE = { salonId: SALON_ID, start: "2026-06-01T00:00:00.000Z", end: "2026-06-30T23:59:59.999Z" };

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("reports.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("identidad del salon", () => {
    it("findSalonTimezone devuelve la zona horaria del salon o null", async () => {
      const db = useDb({ salons: { data: { timezone: "America/Panama" }, error: null } });

      expect(await findSalonTimezone(SALON_ID)).toBe("America/Panama");
      expect(operationsOn(db, "salons")).toEqual([
        { target: "salons", method: "select", args: ["timezone"] },
        { target: "salons", method: "eq", args: ["id", SALON_ID] },
        { target: "salons", method: "maybeSingle", args: [] },
      ]);

      useDb({ salons: { data: null, error: null } });
      expect(await findSalonTimezone(SALON_ID)).toBeNull();

      const dbError = { message: "fallo" };
      useDb({ salons: { data: null, error: dbError } });
      await expect(findSalonTimezone(SALON_ID)).rejects.toBe(dbError);
    });

    it("findSalonReportIdentity devuelve nombre, zona y fecha de creacion, o null", async () => {
      const identity = { name: "Glow", timezone: null, created_at: "2025-01-01T00:00:00.000Z" };
      const db = useDb({ salons: { data: identity, error: null } });

      expect(await findSalonReportIdentity(SALON_ID)).toEqual(identity);
      expect(operationsOn(db, "salons")[0]?.args).toEqual(["name, timezone, created_at"]);

      useDb({ salons: { data: null, error: null } });
      expect(await findSalonReportIdentity(SALON_ID)).toBeNull();

      const dbError = { message: "fallo" };
      useDb({ salons: { data: null, error: dbError } });
      await expect(findSalonReportIdentity(SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("findHistoricalReportRows", () => {
    const history = {
      appointmentMonths: [{ month: "2026-06", count: 3 }],
      busyHours: [{ hour: 10, count: 2 }],
      retailMonths: [{ month: "2026-06", amount: 15 }],
      expenseGroups: [{ label: "Alquiler", amount: 500 }],
      purchaseMonths: [{ month: "2026-06", amount: 40 }],
      productMonths: [{ month: "2026-06", productName: "Tinte", quantity: 2 }],
    };

    it("combina el historico agregado en la BD con el inventario vigente del salon", async () => {
      const db = useDb({
        report_monthly_history: { data: history, error: null },
        inventory_products: {
          data: [
            {
              id: "p1",
              name: "Tinte",
              is_retail_enabled: true,
              is_active: true,
              deleted_at: null,
              inventory_stock_locations: [{ location: "retail", quantity: "2", minimum_quantity: null }],
            },
            {
              id: "p2",
              name: "Viejo",
              is_retail_enabled: false,
              is_active: false,
              deleted_at: null,
              inventory_stock_locations: null,
            },
            {
              id: "p3",
              name: "Borrado",
              is_retail_enabled: false,
              is_active: true,
              deleted_at: "2026-01-01T00:00:00.000Z",
              inventory_stock_locations: [],
            },
          ],
          error: null,
        },
      });

      const rows = await findHistoricalReportRows({ ...RANGE, timezone: "America/Panama" });

      expect(rows).toEqual({
        ...history,
        inventoryProducts: [
          {
            id: "p1",
            name: "Tinte",
            isRetailEnabled: true,
            locations: [{ location: "retail", quantity: 2, minimumQuantity: 0 }],
          },
        ],
      });
      expect(db.operations).toContainEqual({
        target: "report_monthly_history",
        method: "rpc",
        args: [
          {
            p_salon_id: SALON_ID,
            p_start: RANGE.start,
            p_end: RANGE.end,
            p_timezone: "America/Panama",
          },
        ],
      });
      expect(operationsOn(db, "inventory_products")).toContainEqual({
        target: "inventory_products",
        method: "eq",
        args: ["salon_id", SALON_ID],
      });
    });

    it("usa listas vacias cuando el historico o el inventario llegan sin datos", async () => {
      useDb({
        report_monthly_history: { data: null, error: null },
        inventory_products: { data: null, error: null },
      });

      expect(await findHistoricalReportRows({ ...RANGE, timezone: "UTC" })).toEqual({
        appointmentMonths: [],
        busyHours: [],
        retailMonths: [],
        expenseGroups: [],
        purchaseMonths: [],
        productMonths: [],
        inventoryProducts: [],
      });
    });

    it("propaga el error de la RPC o de la consulta de inventario", async () => {
      const rpcError = { message: "rpc" };
      useDb({
        report_monthly_history: { data: null, error: rpcError },
        inventory_products: { data: [], error: null },
      });
      await expect(findHistoricalReportRows({ ...RANGE, timezone: "UTC" })).rejects.toBe(rpcError);

      const inventoryError = { message: "inventario" };
      useDb({
        report_monthly_history: { data: history, error: null },
        inventory_products: { data: null, error: inventoryError },
      });
      await expect(findHistoricalReportRows({ ...RANGE, timezone: "UTC" })).rejects.toBe(inventoryError);
    });
  });
});
