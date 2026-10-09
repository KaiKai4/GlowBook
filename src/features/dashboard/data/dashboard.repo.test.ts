import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findDashboardReportRows,
  findPendingConfirmationRows,
} from "./dashboard.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";
const RANGE = {
  salonId: SALON_ID,
  todayStart: "2026-06-12T00:00:00.000Z",
  todayEnd: "2026-06-12T23:59:59.999Z",
  monthStart: "2026-06-01T00:00:00.000Z",
  chartStart: "2026-01-01T00:00:00.000Z",
};

function useDb(script: Parameters<typeof createSupabaseDouble>[0]): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("dashboard.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("findDashboardReportRows", () => {
    it("agrega las cinco consultas del dashboard acotadas al salon y a sus rangos", async () => {
      const db = useDb({
        appointments: [
          { data: [{ id: "a1", status: "scheduled" }], error: null, count: 3 },
          { data: [{ total_price: 40, status: "completed" }], error: null },
          { data: [{ start_time: "2026-05-02T10:00:00.000Z" }], error: null },
        ],
        customers: { data: null, error: null, count: 7 },
        appointment_items: { data: [{ service: { name: "Corte" }, appointment: { status: "completed" } }], error: null },
      });

      const rows = await findDashboardReportRows(RANGE);

      expect(rows).toEqual({
        todayAppointments: 3,
        monthAppointments: [{ total_price: 40, status: "completed" }],
        monthlyCompletedAppointments: [{ start_time: "2026-05-02T10:00:00.000Z" }],
        totalCustomers: 7,
        bookedServices: [{ service: { name: "Corte" }, appointment: { status: "completed" } }],
      });

      const appointmentOps = operationsOn(db, "appointments");
      expect(appointmentOps).toContainEqual({ target: "appointments", method: "gte", args: ["start_time", RANGE.todayStart] });
      expect(appointmentOps).toContainEqual({ target: "appointments", method: "lte", args: ["start_time", RANGE.todayEnd] });
      expect(appointmentOps).toContainEqual({ target: "appointments", method: "gte", args: ["start_time", RANGE.monthStart] });
      expect(appointmentOps).toContainEqual({ target: "appointments", method: "gte", args: ["start_time", RANGE.chartStart] });
      expect(appointmentOps.filter((op) => op.method === "eq" && op.args[0] === "salon_id")).toHaveLength(3);
      expect(operationsOn(db, "customers")).toContainEqual({ target: "customers", method: "eq", args: ["is_active", true] });
      expect(operationsOn(db, "appointment_items")).toContainEqual({ target: "appointment_items", method: "eq", args: ["salon_id", SALON_ID] });
    });

    it("usa valores por defecto cuando no hay datos ni conteos", async () => {
      useDb({
        appointments: [
          { data: null, error: null, count: null },
          { data: null, error: null },
          { data: null, error: null },
        ],
        customers: { data: null, error: null, count: null },
        appointment_items: { data: null, error: null },
      });

      expect(await findDashboardReportRows(RANGE)).toEqual({
        todayAppointments: 0,
        monthAppointments: [],
        monthlyCompletedAppointments: [],
        totalCustomers: 0,
        bookedServices: [],
      });
    });

    it.each([
      ["hoy", 0],
      ["mes", 1],
      ["grafico", 2],
    ])("propaga el error de la consulta de appointments (%s)", async (_label, failingIndex) => {
      const dbError = { message: "fallo" };
      const responses = [0, 1, 2].map((index) =>
        index === failingIndex ? { data: null, error: dbError } : { data: [], error: null }
      );
      useDb({
        appointments: responses,
        customers: { data: null, error: null, count: 0 },
        appointment_items: { data: [], error: null },
      });

      await expect(findDashboardReportRows(RANGE)).rejects.toBe(dbError);
    });

    it("propaga el error de clientes y de items de cita", async () => {
      const customersError = { message: "clientes" };
      useDb({
        appointments: [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ],
        customers: { data: null, error: customersError },
        appointment_items: { data: [], error: null },
      });
      await expect(findDashboardReportRows(RANGE)).rejects.toBe(customersError);

      const itemsError = { message: "items" };
      useDb({
        appointments: [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ],
        customers: { data: null, error: null, count: 0 },
        appointment_items: { data: null, error: itemsError },
      });
      await expect(findDashboardReportRows(RANGE)).rejects.toBe(itemsError);
    });
  });

  describe("findPendingConfirmationRows", () => {
    it("lista citas programadas desde la fecha indicada, limitadas y ordenadas por inicio", async () => {
      const db = useDb({
        appointments: {
          data: [{ id: "a1", start_time: "2026-06-13T09:00:00.000Z", customer: null }],
          error: null,
        },
      });

      const rows = await findPendingConfirmationRows(SALON_ID, "2026-06-12T00:00:00.000Z");

      expect(rows).toEqual([{ id: "a1", start_time: "2026-06-13T09:00:00.000Z", customer: null }]);
      expect(operationsOn(db, "appointments")).toEqual([
        { target: "appointments", method: "select", args: ["id, start_time, customer:customers(first_name, last_name, phone)"] },
        { target: "appointments", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "appointments", method: "eq", args: ["status", "scheduled"] },
        { target: "appointments", method: "gte", args: ["start_time", "2026-06-12T00:00:00.000Z"] },
        { target: "appointments", method: "order", args: ["start_time", { ascending: true }] },
        { target: "appointments", method: "limit", args: [6] },
      ]);
    });

    it("respeta un limite explicito y devuelve lista vacia sin datos", async () => {
      const db = useDb({ appointments: { data: null, error: null } });

      expect(await findPendingConfirmationRows(SALON_ID, "2026-06-12T00:00:00.000Z", 2)).toEqual([]);
      expect(operationsOn(db, "appointments")).toContainEqual({ target: "appointments", method: "limit", args: [2] });
    });

    it("propaga el error de la consulta", async () => {
      const dbError = { message: "fallo" };
      useDb({ appointments: { data: null, error: dbError } });

      await expect(findPendingConfirmationRows(SALON_ID, "2026-06-12T00:00:00.000Z")).rejects.toBe(dbError);
    });
  });
});
