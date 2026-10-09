import { describe, expect, it, vi } from "vitest";
import { sumExpensesTotal } from "../data/expenses.repo";
import { getManualExpenseTotal } from "./manual-expense-total";

vi.mock("../data/expenses.repo", () => ({
  sumExpensesTotal: vi.fn(),
}));

describe("getManualExpenseTotal", () => {
  it("delega en el repositorio el total de gastos manuales del rango para el salon", async () => {
    vi.mocked(sumExpensesTotal).mockResolvedValue(480);

    expect(await getManualExpenseTotal("salon-1", "2026-06-01", "2026-06-30")).toBe(480);
    expect(sumExpensesTotal).toHaveBeenCalledWith("salon-1", "2026-06-01", "2026-06-30");
  });

  it("propaga el error del repositorio", async () => {
    const failure = new Error("caida");
    vi.mocked(sumExpensesTotal).mockRejectedValue(failure);

    await expect(getManualExpenseTotal("salon-1", "2026-06-01", "2026-06-30")).rejects.toBe(failure);
  });
});
