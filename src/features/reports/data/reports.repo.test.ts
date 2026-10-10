import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import { findSalonReportIdentity } from "./reports.repo";

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

describe("reports.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("identidad del salon", () => {
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
});
