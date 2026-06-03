import { beforeEach, describe, expect, it, vi } from "vitest";
import { findInventoryProducts } from "../data/inventory.repo";
import { getRetailInventoryProducts } from "./retail-inventory-products";

vi.mock("../data/inventory.repo", () => ({
  findInventoryProducts: vi.fn(),
}));

const mockedFindProducts = vi.mocked(findInventoryProducts);

describe("retail inventory product view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active products enabled for vitrina with a narrow stock view", async () => {
    mockedFindProducts.mockResolvedValue([
      {
        id: "retail-1",
        name: "Shampoo",
        category: "Cabello",
        cost_price: 7,
        sale_price: 12,
        is_retail_enabled: true,
        is_active: true,
        inventory_stock_locations: [
          { location: "retail", quantity: "3", minimum_quantity: "1" },
          { location: "storage", quantity: "8", minimum_quantity: "2" },
        ],
      },
      {
        id: "internal-1",
        name: "Esmalte",
        category: "Unas",
        sale_price: 0,
        is_retail_enabled: false,
        is_active: true,
        inventory_stock_locations: [],
      },
      {
        id: "inactive-1",
        name: "Producto viejo",
        category: "Cabello",
        sale_price: 10,
        is_retail_enabled: true,
        is_active: false,
        inventory_stock_locations: [],
      },
    ] as Awaited<ReturnType<typeof findInventoryProducts>>);

    const products = await getRetailInventoryProducts("salon-1");

    expect(products).toEqual([
      {
        id: "retail-1",
        name: "Shampoo",
        category: "Cabello",
        salePrice: 12,
        stock: [
          { location: "retail", quantity: 3 },
          { location: "storage", quantity: 8 },
        ],
      },
    ]);
  });
});
