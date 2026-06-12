import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findExpenses,
  findLifetimeExpenseTotals,
} from "../data/expenses.repo";
import { getInventoryPurchaseExpenseHistory } from "@/features/inventory/use-cases/inventory-purchase-expenses";
import { getExpensesPage } from "./expenses";

vi.mock("../data/expenses.repo", () => ({
  findExpenses: vi.fn(),
  findLifetimeExpenseTotals: vi.fn(),
  insertExpense: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-purchase-expenses", () => ({
  getInventoryPurchaseExpenseHistory: vi.fn(),
}));

const mockedFindExpenses = vi.mocked(findExpenses);
const mockedFindLifetimeExpenseTotals = vi.mocked(findLifetimeExpenseTotals);
const mockedPurchaseHistory = vi.mocked(getInventoryPurchaseExpenseHistory);

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
        category: "other",
        custom_category: null,
        concept: "Internet",
        vendor_name: null,
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

    const result = await getExpensesPage("salon-1");

    expect(result.monthTotal).toBe(65);
    expect(result.lifetimeTotal).toBe(500);
    expect(result.history).toHaveLength(2);
  });
});
