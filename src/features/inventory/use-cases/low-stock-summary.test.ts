import { beforeEach, describe, expect, it, vi } from "vitest";
import { findLowStockProductCount } from "../data/inventory.repo";
import { getLowStockSummary } from "./low-stock-summary";

vi.mock("../data/inventory.repo", () => ({
  findLowStockProductCount: vi.fn(),
}));

const mockedFindLowStockProductCount = vi.mocked(findLowStockProductCount);

describe("low stock summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the pre-counted low stock product total", async () => {
    mockedFindLowStockProductCount.mockResolvedValue(2);

    await expect(getLowStockSummary("salon-1")).resolves.toEqual({ productCount: 2 });
    expect(mockedFindLowStockProductCount).toHaveBeenCalledWith("salon-1");
  });
});
