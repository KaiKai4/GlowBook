import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findExpenses,
  findLifetimeExpenseTotals,
  insertExpense,
  sumExpensesTotal,
} from "./expenses.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("expenses.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("insertExpense", () => {
    it("guarda el gasto del salon normalizando textos vacios a null", async () => {
      const db = useDb({ expenses: { data: null, error: null } });

      await insertExpense(SALON_ID, {
        expense_date: "2026-06-10",
        amount: 25,
        category: "utilities",
        concept: "  Internet  ",
        vendor_name: "",
        receipt_url: "  https://files.example/r.pdf  ",
        note: "",
      });

      expect(operationsOn(db, "expenses")).toContainEqual({
        target: "expenses",
        method: "insert",
        args: [
          {
            salon_id: SALON_ID,
            expense_date: "2026-06-10",
            amount: 25,
            category: "utilities",
            custom_category: null,
            concept: "Internet",
            vendor_name: null,
            receipt_url: "https://files.example/r.pdf",
            note: null,
          },
        ],
      });
    });

    it("guarda el concepto como categoria libre solo cuando la categoria es 'other'", async () => {
      const db = useDb({ expenses: { data: null, error: null } });

      await insertExpense(SALON_ID, {
        expense_date: "2026-06-10",
        amount: 10,
        category: "other",
        concept: "  Regalos de temporada ",
      });

      expect(operationsOn(db, "expenses")[0]).toEqual({
        target: "expenses",
        method: "insert",
        args: [
          expect.objectContaining({
            category: "other",
            custom_category: "Regalos de temporada",
            concept: "Regalos de temporada",
            receipt_url: null,
            note: null,
          }),
        ],
      });
    });

    it("no guarda categoria libre si 'other' llega sin texto", async () => {
      const db = useDb({ expenses: { data: null, error: null } });

      await insertExpense(SALON_ID, { expense_date: "2026-06-10", amount: 10, category: "other", concept: "   " });

      expect(operationsOn(db, "expenses")[0]?.args[0]).toMatchObject({ custom_category: null, concept: null });
    });

    it("propaga el error de insercion", async () => {
      const dbError = { message: "fallo" };
      useDb({ expenses: { data: null, error: dbError } });

      await expect(
        insertExpense(SALON_ID, { expense_date: "2026-06-10", amount: 10, category: "rent" })
      ).rejects.toBe(dbError);
    });
  });

  describe("findExpenses", () => {
    it("lista los gastos del salon por fecha descendente con limite por defecto de 40", async () => {
      const db = useDb({ expenses: { data: [{ id: "e1" }], error: null } });

      expect(await findExpenses(SALON_ID)).toEqual([{ id: "e1" }]);
      expect(operationsOn(db, "expenses")).toEqual([
        expect.objectContaining({ method: "select" }),
        { target: "expenses", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "expenses", method: "order", args: ["expense_date", { ascending: false }] },
        { target: "expenses", method: "order", args: ["created_at", { ascending: false }] },
        { target: "expenses", method: "limit", args: [40] },
      ]);
    });

    it("respeta el limite indicado y devuelve lista vacia sin datos", async () => {
      const db = useDb({ expenses: { data: null, error: null } });

      expect(await findExpenses(SALON_ID, 5)).toEqual([]);
      expect(operationsOn(db, "expenses")).toContainEqual({ target: "expenses", method: "limit", args: [5] });
    });

    it("propaga el error de la consulta", async () => {
      const dbError = { message: "fallo" };
      useDb({ expenses: { data: null, error: dbError } });

      await expect(findExpenses(SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("findLifetimeExpenseTotals", () => {
    it("suma gastos manuales y compras de inventario desde el historico de la BD", async () => {
      const db = useDb({
        report_monthly_history: {
          data: {
            expenseGroups: [{ amount: 100 }, { amount: "50.5" }],
            purchaseMonths: [{ amount: 30 }],
          },
          error: null,
        },
      });

      expect(await findLifetimeExpenseTotals(SALON_ID)).toEqual({
        manual: 150.5,
        inventoryPurchases: 30,
        total: 180.5,
      });
      expect(db.operations).toContainEqual({
        target: "report_monthly_history",
        method: "rpc",
        args: [
          {
            p_salon_id: SALON_ID,
            p_start: "0001-01-01T00:00:00.000Z",
            p_end: "9999-12-31T23:59:59.999Z",
            p_timezone: "UTC",
          },
        ],
      });
    });

    it("devuelve ceros cuando el historico llega vacio o incompleto", async () => {
      useDb({ report_monthly_history: { data: null, error: null } });
      expect(await findLifetimeExpenseTotals(SALON_ID)).toEqual({ manual: 0, inventoryPurchases: 0, total: 0 });

      useDb({ report_monthly_history: { data: { expenseGroups: null, purchaseMonths: [{ amount: null }] }, error: null } });
      expect(await findLifetimeExpenseTotals(SALON_ID)).toEqual({ manual: 0, inventoryPurchases: 0, total: 0 });
    });

    it("propaga el error de la RPC", async () => {
      const dbError = { message: "fallo" };
      useDb({ report_monthly_history: { data: null, error: dbError } });

      await expect(findLifetimeExpenseTotals(SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("sumExpensesTotal", () => {
    it("suma los importes del rango de fechas del salon", async () => {
      const db = useDb({ expenses: { data: [{ amount: 10 }, { amount: "2.5" }, { amount: null }], error: null } });

      expect(await sumExpensesTotal(SALON_ID, "2026-06-01", "2026-06-30")).toBe(12.5);
      expect(operationsOn(db, "expenses")).toEqual([
        { target: "expenses", method: "select", args: ["amount"] },
        { target: "expenses", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "expenses", method: "gte", args: ["expense_date", "2026-06-01"] },
        { target: "expenses", method: "lte", args: ["expense_date", "2026-06-30"] },
      ]);
    });

    it("devuelve cero sin filas y propaga errores", async () => {
      useDb({ expenses: { data: null, error: null } });
      expect(await sumExpensesTotal(SALON_ID, "2026-06-01", "2026-06-30")).toBe(0);

      const dbError = { message: "fallo" };
      useDb({ expenses: { data: null, error: dbError } });
      await expect(sumExpensesTotal(SALON_ID, "2026-06-01", "2026-06-30")).rejects.toBe(dbError);
    });
  });
});
