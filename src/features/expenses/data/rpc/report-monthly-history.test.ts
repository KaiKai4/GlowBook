import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import { reportMonthlyHistoryRpc } from "./report-monthly-history";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const input = {
  salonId: "salon-1",
  start: "0001-01-01T00:00:00.000Z",
  end: "9999-12-31T23:59:59.999Z",
  timezone: "UTC",
};

function useDb(script: Parameters<typeof createSupabaseDouble>[0]): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("reportMonthlyHistoryRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("envia los parametros del salon y devuelve los grupos validados", async () => {
    const db = useDb({
      report_monthly_history: {
        data: { expenseGroups: [{ amount: 10 }], purchaseMonths: [{ amount: "5.5" }] },
        error: null,
      },
    });

    expect(await reportMonthlyHistoryRpc(input)).toEqual({
      expenseGroups: [{ amount: 10 }],
      purchaseMonths: [{ amount: "5.5" }],
    });
    expect(db.operations).toContainEqual({
      target: "report_monthly_history",
      method: "rpc",
      args: [
        {
          p_salon_id: "salon-1",
          p_start: "0001-01-01T00:00:00.000Z",
          p_end: "9999-12-31T23:59:59.999Z",
          p_timezone: "UTC",
        },
      ],
    });
  });

  it("devuelve un objeto vacio cuando la base no devuelve datos", async () => {
    useDb({ report_monthly_history: { data: null, error: null } });

    expect(await reportMonthlyHistoryRpc(input)).toEqual({});
  });

  it("rechaza una respuesta que no tiene la forma esperada", async () => {
    useDb({ report_monthly_history: { data: { expenseGroups: "no-es-lista" }, error: null } });

    await expect(reportMonthlyHistoryRpc(input)).rejects.toThrow(
      "Respuesta inesperada de la RPC report_monthly_history."
    );
  });
});
