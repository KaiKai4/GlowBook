import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordInventoryPurchase } from "@/features/inventory/use-cases/inventory-movements";
import { getInventoryPurchaseExpenseHistory } from "@/features/inventory/use-cases/inventory-purchase-expenses";
import {
  findExpenses,
  findLifetimeExpenseTotals,
  insertExpense,
} from "../data/expenses.repo";
import type { CreateExpenseInput } from "../schemas";
import {
  createExpense,
  createInventoryPurchaseExpense,
  getExpensesPage,
} from "./expenses";

vi.mock("../data/expenses.repo", () => ({
  findExpenses: vi.fn(),
  findLifetimeExpenseTotals: vi.fn(),
  insertExpense: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-purchase-expenses", () => ({
  getInventoryPurchaseExpenseHistory: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-movements", () => ({
  recordInventoryPurchase: vi.fn(),
}));

const mockedFindExpenses = vi.mocked(findExpenses);
const mockedLifetime = vi.mocked(findLifetimeExpenseTotals);
const mockedInsertExpense = vi.mocked(insertExpense);
const mockedPurchaseHistory = vi.mocked(getInventoryPurchaseExpenseHistory);
const mockedRecordPurchase = vi.mocked(recordInventoryPurchase);

const SALON_ID = "salon-1";

type ExpenseRow = Awaited<ReturnType<typeof findExpenses>>[number];

function expenseRow(overrides: Partial<ExpenseRow>): ExpenseRow {
  return {
    id: "e1",
    expense_date: "2026-06-05",
    amount: 10,
    category: "utilities",
    custom_category: null,
    concept: null,
    vendor_name: null,
    receipt_url: null,
    note: null,
    created_at: "2026-06-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("expenses use-cases (ramas)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T12:00:00.000Z"));
    mockedFindExpenses.mockResolvedValue([]);
    mockedPurchaseHistory.mockResolvedValue([]);
    mockedLifetime.mockResolvedValue({ manual: 0, inventoryPurchases: 0, total: 0 });
  });

  describe("getExpensesPage", () => {
    it("describe cada gasto manual con su concepto, comercio, comprobante y detalle", async () => {
      mockedFindExpenses.mockResolvedValue([
        expenseRow({
          id: "other-custom",
          category: "other",
          custom_category: "Regalos",
          concept: null,
          vendor_name: "Tienda",
          receipt_url: "https://files.example/r.pdf",
          note: "Navidad",
        }),
        expenseRow({ id: "sin-concepto", category: "rent", concept: null, custom_category: null, note: null }),
      ]);

      const view = await getExpensesPage(SALON_ID);
      const [withCustom, plain] = view.history;

      expect(withCustom).toMatchObject({
        id: "other-custom",
        type: "manual",
        concept: "Regalos",
        categoryLabel: "Regalos",
        commerceName: "Tienda",
        receiptUrl: "https://files.example/r.pdf",
        note: "Navidad",
        detail: "Navidad",
      });
      expect(plain).toMatchObject({
        concept: "Gasto general",
        categoryLabel: "Alquiler",
        commerceName: null,
        receiptUrl: null,
        detail: "Gasto general",
      });
    });

    it("convierte montos de texto (como llegan de numeric) a numero", async () => {
      mockedFindExpenses.mockResolvedValue([
        expenseRow({ id: "a", amount: "15.25", expense_date: "2026-06-02" }),
      ]);

      const view = await getExpensesPage(SALON_ID);

      expect(view.history[0]?.amount).toBe(15.25);
      expect(view.monthTotal).toBe(15.25);
    });

    it("ordena el historial por fecha descendente y, en empate, por fecha de creacion", async () => {
      mockedFindExpenses.mockResolvedValue([
        expenseRow({ id: "viejo", expense_date: "2026-06-01", created_at: "2026-06-01T08:00:00.000Z" }),
        expenseRow({ id: "mismo-dia-antes", expense_date: "2026-06-09", created_at: "2026-06-09T08:00:00.000Z" }),
        expenseRow({ id: "mismo-dia-despues", expense_date: "2026-06-09", created_at: "2026-06-09T18:00:00.000Z" }),
      ]);
      mockedPurchaseHistory.mockResolvedValue([
        {
          id: "compra",
          date: "2026-06-09",
          amount: 5,
          commerceName: null,
          note: null,
          createdAt: "2026-06-09T12:00:00.000Z",
          detail: "Tintes",
        },
      ]);

      const view = await getExpensesPage(SALON_ID);

      expect(view.history.map((item) => item.id)).toEqual([
        "mismo-dia-despues",
        "compra",
        "mismo-dia-antes",
        "viejo",
      ]);
    });

    it("describe compras de inventario con etiqueta de productos y su detalle", async () => {
      mockedPurchaseHistory.mockResolvedValue([
        {
          id: "compra-1",
          date: "2026-06-04",
          amount: 80,
          commerceName: "Distribuidora",
          note: null,
          createdAt: "2026-06-04T09:00:00.000Z",
          detail: "Tinte, Oxidante",
        },
      ]);

      const view = await getExpensesPage(SALON_ID);

      expect(view.history[0]).toMatchObject({
        type: "inventory_purchase",
        concept: "Compra de inventario",
        categoryLabel: "Productos e insumos",
        commerceName: "Distribuidora",
        receiptUrl: null,
        detail: "Tinte, Oxidante",
      });
    });

    it("excluye del total mensual los gastos de otros meses y del desglose categorias antiguas", async () => {
      mockedFindExpenses.mockResolvedValue([
        expenseRow({ id: "mayo", expense_date: "2026-05-28", amount: 900, category: "rent" }),
        expenseRow({ id: "junio", expense_date: "2026-06-03", amount: 40, category: "marketing" }),
      ]);
      mockedLifetime.mockResolvedValue({ manual: 940, inventoryPurchases: 0, total: 940 });

      const view = await getExpensesPage(SALON_ID);

      expect(view.monthTotal).toBe(40);
      expect(view.lifetimeTotal).toBe(940);
      expect(view.categoryTotals).toEqual([{ category: "marketing", label: "Publicidad y marketing", amount: 40 }]);
      expect(view.topCategory).toMatchObject({ category: "marketing" });
    });

    it("no tiene categoria principal cuando el mes no tiene gastos", async () => {
      mockedFindExpenses.mockResolvedValue([expenseRow({ expense_date: "2026-01-10" })]);

      const view = await getExpensesPage(SALON_ID);

      expect(view.monthTotal).toBe(0);
      expect(view.categoryTotals).toEqual([]);
      expect(view.topCategory).toBeNull();
    });

    it("incluye las compras de inventario del mes como productos en el desglose", async () => {
      mockedPurchaseHistory.mockResolvedValue([
        {
          id: "c1",
          date: "2026-06-06",
          amount: 30,
          commerceName: null,
          note: null,
          createdAt: "2026-06-06T09:00:00.000Z",
          detail: "x",
        },
        {
          id: "c2",
          date: "2026-05-06",
          amount: 99,
          commerceName: null,
          note: null,
          createdAt: "2026-05-06T09:00:00.000Z",
          detail: "y",
        },
      ]);

      const view = await getExpensesPage(SALON_ID);

      expect(view.categoryTotals).toEqual([{ category: "products", label: "Productos e insumos", amount: 30 }]);
      expect(view.monthTotal).toBe(30);
    });
  });

  describe("createExpense", () => {
    const KEY = "00000000-0000-4000-8000-0000000000c1";
    const input: CreateExpenseInput = {
      expense_date: "2026-06-10",
      amount: 25,
      category: "utilities",
      concept: "",
      vendor_name: "",
      note: "",
      receipt_url: undefined,
      idempotency_key: KEY,
    };

    it("registra el gasto del salon con la clave y confirma con mensaje de exito", async () => {
      mockedInsertExpense.mockResolvedValue(undefined);

      expect(await createExpense(SALON_ID, input, KEY)).toEqual({ ok: true, value: "Gasto registrado." });
      expect(mockedInsertExpense).toHaveBeenCalledWith(SALON_ID, input, KEY);
    });

    it("devuelve error legible cuando la insercion lanza un Error", async () => {
      mockedInsertExpense.mockRejectedValue(new Error("sin conexion"));

      const result = await createExpense(SALON_ID, input, KEY);

      expect(result.ok).toBe(false);
      expect(typeof (result as { error: unknown }).error).toBe("string");
    });

    it("usa el mensaje generico cuando el fallo no es un Error", async () => {
      mockedInsertExpense.mockRejectedValue("fallo");

      expect(await createExpense(SALON_ID, input, KEY)).toEqual({
        ok: false,
        error: "No se pudo registrar el gasto.",
      });
    });
  });

  describe("createInventoryPurchaseExpense", () => {
    const KEY = "00000000-0000-4000-8000-0000000000c1";
    const purchase = {
      supplier_name: "Distribuidora",
      purchase_date: "2026-06-10",
      product_id: "00000000-0000-4000-8000-000000000033",
      location: "storage" as const,
      quantity: 2,
      unit_cost: 5,
      note: "",
      idempotency_key: KEY,
    };

    it("registra la compra en bodega con la clave y confirma con mensaje de exito", async () => {
      mockedRecordPurchase.mockResolvedValue({ ok: true, value: undefined });

      expect(await createInventoryPurchaseExpense(SALON_ID, purchase, KEY)).toEqual({
        ok: true,
        value: "Compra de inventario registrada.",
      });
      expect(mockedRecordPurchase).toHaveBeenCalledWith(
        SALON_ID,
        { ...purchase, location: "storage" },
        KEY
      );
    });

    it("propaga el error del registro de inventario tal cual", async () => {
      const failure = { ok: false as const, error: "Stock no disponible." };
      mockedRecordPurchase.mockResolvedValue(failure);

      expect(await createInventoryPurchaseExpense(SALON_ID, purchase, KEY)).toBe(failure);
    });
  });
});
