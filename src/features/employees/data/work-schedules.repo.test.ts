import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeDbResponse,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import { deleteWorkSchedule, upsertWorkSchedule } from "./work-schedules.repo";

// Horarios semanales (work_schedules): upsert y borrado acotados al salón.

const serverHolder = vi.hoisted((): { current: FakeSupabaseClient | null } => ({ current: null }));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverHolder.current,
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";

let db: FakeSupabase;

function useTables(responses: Record<string, FakeDbResponse[]>) {
  db = createFakeSupabase(responses);
  serverHolder.current = db.client;
}

function eqCalls(table: string): unknown[][] {
  return db
    .callsFor(table)
    .filter((call) => call.method === "eq")
    .map((call) => call.args);
}

describe("work schedules repo", () => {
  beforeEach(() => {
    serverHolder.current = null;
  });

  describe("work schedules", () => {
    const schedule = {
      employee_id: EMPLOYEE_ID,
      day_of_week: 1,
      start_time: "09:00",
      end_time: "17:00",
      is_active: true,
    };

    it("hace upsert del bloque con salon_id y el conflicto por salón, empleado, día y horas", async () => {
      useTables({ work_schedules: [{ data: { id: "ws-1" } }] });

      await expect(upsertWorkSchedule(SALON_ID, schedule)).resolves.toEqual({ id: "ws-1" });

      expect(db.argsOf("work_schedules", "upsert")).toEqual([
        { ...schedule, salon_id: SALON_ID },
        { onConflict: "salon_id,employee_id,day_of_week,start_time,end_time" },
      ]);
    });

    it("propaga el error de upsert", async () => {
      useTables({ work_schedules: [{ error: { message: "solapado" } }] });

      await expect(upsertWorkSchedule(SALON_ID, schedule)).rejects.toEqual({ message: "solapado" });
    });

    it("borra un bloque solo dentro del salón indicado", async () => {
      useTables({ work_schedules: [{}] });

      await deleteWorkSchedule("ws-1", SALON_ID);

      expect(eqCalls("work_schedules")).toEqual([
        ["id", "ws-1"],
        ["salon_id", SALON_ID],
      ]);
    });

    it("propaga el error de borrado", async () => {
      useTables({ work_schedules: [{ error: { message: "no borrable" } }] });

      await expect(deleteWorkSchedule("ws-1", SALON_ID)).rejects.toEqual({
        message: "no borrable",
      });
    });
  });

});
