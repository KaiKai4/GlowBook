import { beforeEach, describe, expect, it, vi } from "vitest";
import { getManualExpenseTotal } from "@/features/expenses/use-cases/manual-expense-total";
import { getInventoryPurchaseTotal } from "@/features/inventory/use-cases/inventory-purchase-total";
import { getRetailRevenueTotal } from "@/features/retail/use-cases/retail-revenue";
import { getExternalOperationalMoney } from "./operational-money";

vi.mock("@/features/expenses/use-cases/manual-expense-total", () => ({
  getManualExpenseTotal: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-purchase-total", () => ({
  getInventoryPurchaseTotal: vi.fn(),
}));

vi.mock("@/features/retail/use-cases/retail-revenue", () => ({
  getRetailRevenueTotal: vi.fn(),
}));

const mockedExpenses = vi.mocked(getManualExpenseTotal);
const mockedPurchases = vi.mocked(getInventoryPurchaseTotal);
const mockedRetail = vi.mocked(getRetailRevenueTotal);

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
