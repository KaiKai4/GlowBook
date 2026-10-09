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
} from "./expenses.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";
const KEY = "00000000-0000-4000-8000-0000000000c1";

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
      }, KEY);

      expect(operationsOn(db, "expenses")).toContainEqual({
        target: "expenses",
        method: "insert",
        args: [
          {
            id: KEY,
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
      }, KEY);

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

      await insertExpense(
        SALON_ID,
        { expense_date: "2026-06-10", amount: 10, category: "other", concept: "   " },
        KEY
      );

      expect(operationsOn(db, "expenses")[0]?.args[0]).toMatchObject({ custom_category: null, concept: null });
    });

    it("propaga el error de insercion", async () => {
      const dbError = { message: "fallo", code: "42501" };
      useDb({ expenses: { data: null, error: dbError } });

      await expect(
        insertExpense(SALON_ID, { expense_date: "2026-06-10", amount: 10, category: "rent" }, KEY)
      ).rejects.toBe(dbError);
    });

    it("un reenvio con la misma clave se trata como exito si la fila ya existe en el salon", async () => {
      const db = useDb({
        expenses: [
          { data: null, error: { message: "duplicate key", code: "23505" } },
          { data: { id: KEY }, error: null },
        ],
      });

      await expect(
        insertExpense(SALON_ID, { expense_date: "2026-06-10", amount: 10, category: "rent" }, KEY)
      ).resolves.toBeUndefined();
      expect(operationsOn(db, "expenses").map((op) => op.method)).toEqual([
        "insert",
        "select",
        "eq",
        "eq",
        "maybeSingle",
      ]);
      expect(operationsOn(db, "expenses")).toContainEqual({
        target: "expenses",
        method: "eq",
        args: ["salon_id", SALON_ID],
      });
    });

    it("rechaza la clave repetida si la fila pertenece a otro salon", async () => {
      const conflict = { message: "duplicate key", code: "23505" };
      useDb({
        expenses: [{ data: null, error: conflict }, { data: null, error: null }],
      });

      await expect(
        insertExpense(SALON_ID, { expense_date: "2026-06-10", amount: 10, category: "rent" }, KEY)
      ).rejects.toBe(conflict);
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

});
