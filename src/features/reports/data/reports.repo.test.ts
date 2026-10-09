import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type QueryResponse,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findHistoricalReportRows,
  findOperationalReportRows,
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

  describe("findOperationalReportRows", () => {
    it("normaliza citas, lineas completadas (precio neto nunca negativo) y clientes nuevos", async () => {
      const db = useDb({
        appointments: {
          data: [{ id: "a1", status: "completed", total_price: "120", discount_amount: null }],
          error: null,
        },
        appointment_items: {
          data: [
            {
              appointment_id: "a1",
              price: 100,
              discount_amount: 10,
              service: { id: "s1", name: "Corte" },
              employee: [{ id: "e1", first_name: "Ana", last_name: "Ruiz", commission_percentage: "30" }],
            },
            {
              appointment_id: "a1",
              price: 5,
              discount_amount: 20,
              service: null,
              employee: null,
            },
            {
              appointment_id: "a1",
              price: null,
              discount_amount: null,
              service: [],
              employee: { id: "e2", first_name: "", last_name: "", commission_percentage: null },
            },
          ],
          error: null,
        },
        customers: { data: null, error: null, count: 4 },
      });

      const rows = await findOperationalReportRows(RANGE);

      expect(rows).toEqual({
        appointments: [{ id: "a1", status: "completed", totalPrice: 120, discountAmount: 0 }],
        items: [
          {
            appointmentId: "a1",
            price: 90,
            serviceId: "s1",
            serviceName: "Corte",
            employeeId: "e1",
            employeeName: "Ana Ruiz",
            employeeCommissionPct: 30,
          },
          {
            appointmentId: "a1",
            price: 0,
            serviceId: null,
            serviceName: null,
            employeeId: null,
            employeeName: null,
            employeeCommissionPct: 0,
          },
          {
            appointmentId: "a1",
            price: 0,
            serviceId: null,
            serviceName: null,
            employeeId: "e2",
            employeeName: null,
            employeeCommissionPct: 0,
          },
        ],
        newCustomers: 4,
      });

      expect(operationsOn(db, "appointments")).toContainEqual({
        target: "appointments",
        method: "gte",
        args: ["start_time", RANGE.start],
      });
      const itemOps = operationsOn(db, "appointment_items");
      expect(itemOps).toContainEqual({ target: "appointment_items", method: "eq", args: ["salon_id", SALON_ID] });
      expect(itemOps).toContainEqual({ target: "appointment_items", method: "eq", args: ["appointment.status", "completed"] });
      expect(operationsOn(db, "customers")).toContainEqual({ target: "customers", method: "eq", args: ["is_temporary", false] });
      expect(operationsOn(db, "customers")).toContainEqual({ target: "customers", method: "eq", args: ["salon_id", SALON_ID] });
    });

    it("devuelve listas vacias y cero clientes cuando no hay datos", async () => {
      useDb({
        appointments: { data: null, error: null },
        appointment_items: { data: null, error: null },
        customers: { data: null, error: null, count: null },
      });

      expect(await findOperationalReportRows(RANGE)).toEqual({ appointments: [], items: [], newCustomers: 0 });
    });

    it.each([
      ["citas", 0],
      ["items", 1],
      ["clientes", 2],
    ])("propaga el error de la consulta de %s", async (_label, failingIndex) => {
      const dbError = { message: "fallo" };
      const base: QueryResponse[] = [
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 0 },
      ];
      const responses: QueryResponse[] = base.map((response, index) =>
        index === failingIndex ? { data: null, error: dbError } : response
      );
      useDb({
        appointments: responses.slice(0, 1),
        appointment_items: responses.slice(1, 2),
        customers: responses.slice(2, 3),
      });

      await expect(findOperationalReportRows(RANGE)).rejects.toBe(dbError);
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
