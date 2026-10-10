import { beforeEach, describe, expect, it, vi } from "vitest";
import { findInventoryProducts } from "../data/inventory.repo";
import { getRetailInventoryProducts } from "./retail-inventory-products";

vi.mock("../data/inventory.repo", () => ({
  findInventoryProducts: vi.fn(),
}));

const mockedFindProducts = vi.mocked(findInventoryProducts);

type ProductRow = Awaited<ReturnType<typeof findInventoryProducts>>[number];

function product(overrides: Record<string, unknown>): ProductRow {
  return {
    id: "p",
    salon_id: "salon-1",
    name: "Producto",
    category: "Cuidado",
    cost_price: 1,
    sale_price: 5,
    is_retail_enabled: true,
    is_active: true,
    inventory_stock_locations: [],
    ...overrides,
  } as ProductRow;
}

describe("getRetailInventoryProducts (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra solo productos activos y habilitados para vitrina", async () => {
    mockedFindProducts.mockResolvedValue([
      product({ id: "ok", name: "Shampoo" }),
      product({ id: "inactivo", is_active: false }),
      product({ id: "no-vitrina", is_retail_enabled: false }),
    ]);

    const result = await getRetailInventoryProducts("salon-1");

    expect(result.map((item) => item.id)).toEqual(["ok"]);
    expect(mockedFindProducts).toHaveBeenCalledWith("salon-1");
  });

  it("convierte precio y cantidades a número, y usa categoría vacia si no hay", async () => {
    mockedFindProducts.mockResolvedValue([
      product({
        id: "p1",
        category: null,
        sale_price: "7.25",
        inventory_stock_locations: [
          { location: "retail", quantity: "3" },
          { location: "storage", quantity: null },
        ],
      }),
      product({ id: "p2", sale_price: null, inventory_stock_locations: null }),
    ]);

    const result = await getRetailInventoryProducts("salon-1");

    expect(result).toEqual([
      {
        id: "p1",
        name: "Producto",
        category: "",
        salePrice: 7.25,
        stock: [
          { location: "retail", quantity: 3 },
          { location: "storage", quantity: 0 },
        ],
      },
      {
        id: "p2",
        name: "Producto",
        category: "Cuidado",
        salePrice: 0,
        stock: [],
      },
    ]);
  });

  it("devuelve lista vacia cuando no hay productos", async () => {
    mockedFindProducts.mockResolvedValue([]);

    expect(await getRetailInventoryProducts("salon-1")).toEqual([]);
  });
});
