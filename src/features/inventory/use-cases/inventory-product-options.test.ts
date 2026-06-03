import { beforeEach, describe, expect, it, vi } from "vitest";
import { findInventoryProducts } from "../data/inventory.repo";
import { getInventoryProductOptions } from "./inventory-product-options";

vi.mock("../data/inventory.repo", () => ({
  findInventoryProducts: vi.fn(),
}));

const mockedFindProducts = vi.mocked(findInventoryProducts);

describe("inventory product options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active product options sorted by name", async () => {
    mockedFindProducts.mockResolvedValue([
      { id: "b", name: "Shampoo", is_active: true },
      { id: "inactive", name: "Archivado", is_active: false },
      { id: "a", name: "Acondicionador", is_active: true },
    ] as Awaited<ReturnType<typeof findInventoryProducts>>);

    const options = await getInventoryProductOptions("salon-1");

    expect(options).toEqual([
      { id: "a", name: "Acondicionador" },
      { id: "b", name: "Shampoo" },
    ]);
  });
});
