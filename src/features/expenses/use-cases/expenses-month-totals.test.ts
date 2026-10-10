import { beforeEach, describe, expect, it, vi } from "vitest";

import { findExpenses, findLifetimeExpenseTotals } from "../data/expenses.repo";
import { reportExpenseMonthTotalsRpc } from "../data/rpc/report-expense-month-totals";
import { getInventoryPurchaseExpenseHistory } from "@/features/inventory/use-cases/inventory-purchase-expenses";
import { getExpensesPage } from "./expenses";

vi.mock("../data/expenses.repo", () => ({
  findExpenses: vi.fn(),
  findLifetimeExpenseTotals: vi.fn(),
}));

vi.mock("../data/rpc/report-expense-month-totals", () => ({
  reportExpenseMonthTotalsRpc: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-purchase-expenses", () => ({
  getInventoryPurchaseExpenseHistory: vi.fn(),
}));

const mockedFindExpenses = vi.mocked(findExpenses);
const mockedLifetime = vi.mocked(findLifetimeExpenseTotals);
const mockedPurchases = vi.mocked(getInventoryPurchaseExpenseHistory);
const mockedMonthTotals = vi.mocked(reportExpenseMonthTotalsRpc);

describe("getExpensesPage: totales del mes desde la base", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 12, 0, 0));
    mockedLifetime.mockResolvedValue({ manual: 0, inventoryPurchases: 0, total: 0 });
    mockedPurchases.mockResolvedValue([]);
  });

  it("calcula monthTotal y categoryTotals con la RPC aunque la lista visible tenga pocos gastos", async () => {
    // La lista visible solo trae 2 gastos (limite 40); el mes real tiene mas.
    mockedFindExpenses.mockResolvedValue([
      {
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
      },
    ]);
    mockedMonthTotals.mockResolvedValue([
      { category: "rent", customCategory: null, amount: 1500 },
      { category: "utilities", customCategory: null, amount: 900 },
      { category: "products", customCategory: null, amount: 300 },
    ]);

    const view = await getExpensesPage("salon-1");

    expect(mockedMonthTotals).toHaveBeenCalledWith({
      salonId: "salon-1",
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(view.monthTotal).toBe(2700);
    expect(view.categoryTotals).toEqual([
      { category: "rent", label: "Alquiler", amount: 1500 },
      { category: "utilities", label: "Servicios básicos", amount: 900 },
      { category: "products", label: "Productos e insumos", amount: 300 },
    ]);
    expect(view.topCategory).toMatchObject({ category: "rent", amount: 1500 });
    expect(view.history).toHaveLength(1);
  });
});
