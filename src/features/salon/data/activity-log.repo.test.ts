import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import { findSalonActivity } from "./activity-log.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("activity-log.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("lista la actividad mas reciente del salon con limite por defecto de 150", async () => {
    const row = {
      id: "log-1",
      actor_id: "user-1",
      actor_email: "dueno@example.com",
      table_name: "appointments",
      action: "insert",
      record_id: "a1",
      record_label: "Cita",
      created_at: "2026-06-12T10:00:00.000Z",
    };
    const db = useDb({ salon_activity_log: { data: [row], error: null } });

    expect(await findSalonActivity("salon-1")).toEqual([row]);
    expect(operationsOn(db, "salon_activity_log")).toEqual([
      {
        target: "salon_activity_log",
        method: "select",
        args: ["id, actor_id, actor_email, table_name, action, record_id, record_label, created_at"],
      },
      { target: "salon_activity_log", method: "eq", args: ["salon_id", "salon-1"] },
      { target: "salon_activity_log", method: "order", args: ["created_at", { ascending: false }] },
      { target: "salon_activity_log", method: "limit", args: [150] },
    ]);
  });

  it("respeta el limite indicado y devuelve lista vacia sin datos", async () => {
    const db = useDb({ salon_activity_log: { data: null, error: null } });

    expect(await findSalonActivity("salon-1", 10)).toEqual([]);
    expect(operationsOn(db, "salon_activity_log")).toContainEqual({
      target: "salon_activity_log",
      method: "limit",
      args: [10],
    });
  });

  it("lanza el error original de la consulta sin reenvolverlo", async () => {
    const dbError = { message: "sin permiso", code: "42501" };
    useDb({ salon_activity_log: { data: null, error: dbError } });

    await expect(findSalonActivity("salon-1")).rejects.toBe(dbError);
  });
});
