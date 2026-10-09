import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findPendingConfirmationRows,
} from "./dashboard.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

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
