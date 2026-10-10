import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import { reportExpenseMonthTotalsRpc } from "./report-expense-month-totals";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const input = { salonId: "salon-1", from: "2026-06-01", to: "2026-06-30" };

function useDb(script: Parameters<typeof createSupabaseDouble>[0]): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("reportExpenseMonthTotalsRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("envia el salon y el rango, y convierte los importes a numero", async () => {
    const db = useDb({
      report_expense_month_totals: {
        data: [
          { category: "rent", custom_category: null, amount: "1500.50" },
          { category: "other", custom_category: "Regalos", amount: 20 },
        ],
        error: null,
      },
    });

    expect(await reportExpenseMonthTotalsRpc(input)).toEqual([
      { category: "rent", customCategory: null, amount: 1500.5 },
      { category: "other", customCategory: "Regalos", amount: 20 },
    ]);
    expect(db.operations).toContainEqual({
      target: "report_expense_month_totals",
      method: "rpc",
      args: [{ p_salon_id: "salon-1", p_from: "2026-06-01", p_to: "2026-06-30" }],
    });
  });

  it("devuelve una lista vacia cuando la base no devuelve datos", async () => {
    useDb({ report_expense_month_totals: { data: null, error: null } });

    expect(await reportExpenseMonthTotalsRpc(input)).toEqual([]);
  });
});
