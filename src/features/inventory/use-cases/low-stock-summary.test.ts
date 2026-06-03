import { beforeEach, describe, expect, it, vi } from "vitest";
import { findInventoryProducts } from "../data/inventory.repo";
import { getLowStockSummary } from "./low-stock-summary";

vi.mock("../data/inventory.repo", () => ({
  findInventoryProducts: vi.fn(),
}));

const mockedFindProducts = vi.mocked(findInventoryProducts);

describe("low stock summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts products with at least one low or empty stock location", async () => {
    mockedFindProducts.mockResolvedValue([
      {
        id: "ok",
        inventory_stock_locations: [
          { location: "storage", quantity: "5", minimum_quantity: "2" },
        ],
      },
      {
        id: "low",
        inventory_stock_locations: [
          { location: "retail", quantity: "1", minimum_quantity: "2" },
        ],
      },
      {
        id: "empty",
        inventory_stock_locations: [
          { location: "internal", quantity: "0", minimum_quantity: "1" },
        ],
      },
    ] as Awaited<ReturnType<typeof findInventoryProducts>>);

    await expect(getLowStockSummary("salon-1")).resolves.toEqual({ productCount: 2 });
  });
});
