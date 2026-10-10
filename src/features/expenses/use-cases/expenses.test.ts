import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findExpenses,
  findLifetimeExpenseTotals,
} from "../data/expenses.repo";
import { reportExpenseMonthTotalsRpc } from "../data/rpc/report-expense-month-totals";
import { getInventoryPurchaseExpenseHistory } from "@/features/inventory/use-cases/inventory-purchase-expenses";
import { getExpensesPage } from "./expenses";

vi.mock("../data/expenses.repo", () => ({
  findExpenses: vi.fn(),
  findLifetimeExpenseTotals: vi.fn(),
  insertExpense: vi.fn(),
}));

vi.mock("../data/rpc/report-expense-month-totals", () => ({
  reportExpenseMonthTotalsRpc: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-purchase-expenses", () => ({
  getInventoryPurchaseExpenseHistory: vi.fn(),
}));

const mockedFindExpenses = vi.mocked(findExpenses);
const mockedFindLifetimeExpenseTotals = vi.mocked(findLifetimeExpenseTotals);
const mockedPurchaseHistory = vi.mocked(getInventoryPurchaseExpenseHistory);
const mockedMonthTotals = vi.mocked(reportExpenseMonthTotalsRpc);

describe("getExpensesPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T12:00:00.000Z"));
  });

  it("uses the database aggregate for the lifetime card instead of the visible history", async () => {
    mockedFindExpenses.mockResolvedValue([
      {
        id: "expense-1",
        expense_date: "2026-06-10",
        amount: 25,
        category: "utilities",
        custom_category: null,
        concept: "Internet",
        vendor_name: null,
        receipt_url: null,
        note: null,
        created_at: "2026-06-10T12:00:00.000Z",
      },
    ]);
    mockedPurchaseHistory.mockResolvedValue([
      {
        id: "purchase-1",
        date: "2026-06-11",
        amount: 40,
        commerceName: null,
        note: null,
        createdAt: "2026-06-11T12:00:00.000Z",
        detail: "Productos",
      },
    ]);
    mockedFindLifetimeExpenseTotals.mockResolvedValue({
      manual: 300,
      inventoryPurchases: 200,
      total: 500,
    });
    mockedMonthTotals.mockResolvedValue([
      { category: "utilities", customCategory: null, amount: 25 },
      { category: "products", customCategory: null, amount: 40 },
    ]);

    const result = await getExpensesPage("salon-1");

    expect(result.monthTotal).toBe(65);
    expect(result.lifetimeTotal).toBe(500);
    expect(result.history).toHaveLength(2);
  });

  it("breaks the month down by category, counting inventory purchases as products", async () => {
    mockedFindExpenses.mockResolvedValue([
      {
        id: "e1",
        expense_date: "2026-06-05",
        amount: 500,
        category: "rent",
        custom_category: null,
        concept: null,
        vendor_name: null,
        receipt_url: null,
        note: null,
        created_at: "2026-06-05T12:00:00.000Z",
      },
      {
        id: "e2",
        expense_date: "2026-06-06",
        amount: 80,
        category: "marketing",
        custom_category: null,
        concept: null,
        vendor_name: null,
        receipt_url: null,
        note: null,
        created_at: "2026-06-06T12:00:00.000Z",
      },
    ]);
    mockedPurchaseHistory.mockResolvedValue([
      {
        id: "p1",
        date: "2026-06-07",
        amount: 120,
        commerceName: null,
        note: null,
        createdAt: "2026-06-07T12:00:00.000Z",
        detail: "Tintes",
      },
    ]);
    mockedFindLifetimeExpenseTotals.mockResolvedValue({ manual: 0, inventoryPurchases: 0, total: 0 });
    mockedMonthTotals.mockResolvedValue([
      { category: "rent", customCategory: null, amount: 500 },
      { category: "products", customCategory: null, amount: 120 },
      { category: "marketing", customCategory: null, amount: 80 },
    ]);

    const result = await getExpensesPage("salon-1");

    expect(result.topCategory).toMatchObject({ label: "Alquiler", amount: 500 });
    expect(result.categoryTotals).toEqual([
      { category: "rent", label: "Alquiler", amount: 500 },
      { category: "products", label: "Productos e insumos", amount: 120 },
      { category: "marketing", label: "Publicidad y marketing", amount: 80 },
    ]);
  });
});
