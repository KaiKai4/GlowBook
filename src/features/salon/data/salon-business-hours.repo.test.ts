import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import { findBusinessHours, upsertBusinessHours } from "./salon-business-hours.repo";

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

describe("salon-business-hours.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("findBusinessHours", () => {
    it("lista el horario del salon ordenado por dia y devuelve lista vacia sin datos", async () => {
      const db = useDb({ salon_business_hours: { data: [{ day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00" }], error: null } });

      expect(await findBusinessHours(SALON_ID)).toEqual([
        { day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00" },
      ]);
      expect(operationsOn(db, "salon_business_hours")).toEqual([
        { target: "salon_business_hours", method: "select", args: ["day_of_week, is_open, open_time, close_time"] },
        { target: "salon_business_hours", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "salon_business_hours", method: "order", args: ["day_of_week", { ascending: true }] },
      ]);

      useDb({ salon_business_hours: { data: null, error: null } });
      expect(await findBusinessHours(SALON_ID)).toEqual([]);

      useDb({ salon_business_hours: { data: null, error: { message: "horario caido" } } });
      await expect(findBusinessHours(SALON_ID)).rejects.toEqual({ message: "horario caido" });
    });
  });

  describe("upsertBusinessHours", () => {
    it("hace upsert de las filas de horario usando salon_id+day_of_week como conflicto", async () => {
      const db = useDb({ salon_business_hours: { data: null, error: null } });
      const rows = [
        { salon_id: SALON_ID, day_of_week: 0, is_open: false, open_time: null, close_time: null },
      ];

      await upsertBusinessHours(rows);

      expect(operationsOn(db, "salon_business_hours")).toEqual([
        { target: "salon_business_hours", method: "upsert", args: [rows, { onConflict: "salon_id,day_of_week" }] },
      ]);
    });

    it("propaga el error del upsert", async () => {
      const dbError = { message: "fallo" };
      useDb({ salon_business_hours: { data: null, error: dbError } });

      await expect(upsertBusinessHours([])).rejects.toBe(dbError);
    });
  });

});
