import { beforeEach, describe, expect, it, vi } from "vitest";
import { findInventoryPurchaseHistory } from "../data/inventory.repo";
import { getInventoryPurchaseExpenseHistory } from "./inventory-purchase-expenses";

vi.mock("../data/inventory.repo", () => ({
  findInventoryPurchaseHistory: vi.fn(),
}));

const mockedFindPurchaseHistory = vi.mocked(findInventoryPurchaseHistory);

describe("inventory purchase expense history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps inventory purchases into expense history items without exposing repo shape", async () => {
    mockedFindPurchaseHistory.mockResolvedValue([
      {
        id: "purchase-1",
        purchase_date: "2030-01-15",
        total_cost: "45.50",
        supplier_name: "Panafoto",
        note: "Reposicion",
        created_at: "2030-01-15T10:00:00.000Z",
        inventory_purchase_items: [
          { product: { name: "Shampoo" } },
          { product: [{ name: "Acondicionador" }] },
        ],
      },
    ] as Awaited<ReturnType<typeof findInventoryPurchaseHistory>>);

    const history = await getInventoryPurchaseExpenseHistory("salon-1");

    expect(history).toEqual([
      {
        id: "purchase-1",
        date: "2030-01-15",
        amount: 45.5,
        commerceName: "Panafoto",
        note: "Reposicion",
        createdAt: "2030-01-15T10:00:00.000Z",
        detail: "Shampoo, Acondicionador",
      },
    ]);
  });
});
