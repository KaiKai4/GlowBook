import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import { findOnboardingCounts } from "./onboarding.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

describe("onboarding.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("cuenta servicios, empleados, clientes y citas del salon con consultas head", async () => {
    const db = createSupabaseDouble({
      services: { data: null, error: null, count: 4 },
      employees: { data: null, error: null, count: 2 },
      customers: { data: null, error: null, count: 9 },
      appointments: { data: null, error: null, count: 12 },
    });
    serverClient.current = db;

    const counts = await findOnboardingCounts(SALON_ID);

    expect(counts).toEqual({ services: 4, employees: 2, customers: 9, appointments: 12 });
    for (const table of ["services", "employees", "customers", "appointments"]) {
      expect(operationsOn(db, table)).toEqual([
        { target: table, method: "select", args: ["id", { count: "exact", head: true }] },
        { target: table, method: "eq", args: ["salon_id", SALON_ID] },
      ]);
    }
  });

  it("devuelve cero cuando algun conteo llega sin valor", async () => {
    serverClient.current = createSupabaseDouble({
      services: { data: null, error: null, count: null },
      employees: { data: null, error: null, count: null },
      customers: { data: null, error: null, count: null },
      appointments: { data: null, error: null, count: null },
    });

    expect(await findOnboardingCounts(SALON_ID)).toEqual({
      services: 0,
      employees: 0,
      customers: 0,
      appointments: 0,
    });
  });

  it("propaga el primer error de conteo encontrado", async () => {
    const dbError = { message: "sin acceso" };
    serverClient.current = createSupabaseDouble({
      services: { data: null, error: null, count: 1 },
      employees: { data: null, error: dbError },
      customers: { data: null, error: null, count: 1 },
      appointments: { data: null, error: null, count: 1 },
    });

    await expect(findOnboardingCounts(SALON_ID)).rejects.toBe(dbError);
  });
});
