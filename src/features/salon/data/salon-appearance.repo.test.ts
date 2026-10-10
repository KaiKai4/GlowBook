import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import { updateSalonBackground, updateSalonTheme } from "./salon-appearance.repo";

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

describe("salon-appearance.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it.each([
    ["tema", () => updateSalonTheme(SALON_ID, "dark"), { theme: "dark" }],
    ["fondo", () => updateSalonBackground(SALON_ID, "dots"), { bg_style: "dots" }],
  ])("actualiza %s del salón indicado", async (_label, run, payload) => {
    const db = useDb({ salons: { data: null, error: null } });

    await run();

    expect(operationsOn(db, "salons")).toEqual([
      { target: "salons", method: "update", args: [payload] },
      { target: "salons", method: "eq", args: ["id", SALON_ID] },
    ]);
  });
});
