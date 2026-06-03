import { beforeEach, describe, expect, it, vi } from "vitest";
import { sumExpensesTotal } from "@/features/expenses/data/expenses.repo";
import { sumInventoryPurchasesTotal } from "@/features/inventory/data/inventory.repo";
import { sumRetailSalesTotal } from "@/features/retail/data/retail.repo";
import { getExternalOperationalMoney } from "./operational-money";

vi.mock("@/features/expenses/data/expenses.repo", () => ({
  sumExpensesTotal: vi.fn(),
}));

vi.mock("@/features/inventory/data/inventory.repo", () => ({
  sumInventoryPurchasesTotal: vi.fn(),
}));

vi.mock("@/features/retail/data/retail.repo", () => ({
  sumRetailSalesTotal: vi.fn(),
}));

const mockedExpenses = vi.mocked(sumExpensesTotal);
const mockedPurchases = vi.mocked(sumInventoryPurchasesTotal);
const mockedRetail = vi.mocked(sumRetailSalesTotal);

describe("external operational money", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads non-appointment money sources behind one use-case Interface", async () => {
    mockedRetail.mockResolvedValue(75);
    mockedExpenses.mockResolvedValue(20);
    mockedPurchases.mockResolvedValue(30);

    const totals = await getExternalOperationalMoney({
      salonId: "salon-1",
      fromIso: "2026-06-01T00:00:00.000Z",
      toIso: "2026-06-03T23:59:59.999Z",
      fromDate: "2026-06-01",
      toDate: "2026-06-03",
    });

    expect(totals).toEqual({
      retailRevenue: 75,
      manualExpenses: 20,
      inventoryPurchases: 30,
    });
    expect(mockedRetail).toHaveBeenCalledWith(
      "salon-1",
      "2026-06-01T00:00:00.000Z",
      "2026-06-03T23:59:59.999Z"
    );
    expect(mockedExpenses).toHaveBeenCalledWith("salon-1", "2026-06-01", "2026-06-03");
    expect(mockedPurchases).toHaveBeenCalledWith("salon-1", "2026-06-01", "2026-06-03");
  });
});
