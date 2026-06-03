import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRetailSale, getRetailPage } from "./retail-sales";
import { findCustomers } from "@/features/customers/data/customers.repo";
import { getRetailInventoryProducts } from "@/features/inventory/use-cases/retail-inventory-products";
import { findRecentRetailSales, recordRetailSaleAtomically } from "../data/retail.repo";

vi.mock("@/features/customers/data/customers.repo", () => ({
  findCustomers: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/retail-inventory-products", () => ({
  getRetailInventoryProducts: vi.fn(),
}));

vi.mock("../data/retail.repo", () => ({
  findRecentRetailSales: vi.fn(),
  recordRetailSaleAtomically: vi.fn(),
}));

const mockedFindCustomers = vi.mocked(findCustomers);
const mockedGetRetailInventoryProducts = vi.mocked(getRetailInventoryProducts);
const mockedRecentSales = vi.mocked(findRecentRetailSales);
const mockedRecordSale = vi.mocked(recordRetailSaleAtomically);

describe("retail sales use-cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers retail sales through the atomic retail sale adapter", async () => {
    mockedRecordSale.mockResolvedValue({ id: "sale-1" });

    const result = await createRetailSale("salon-1", {
      customer_id: "",
      product_id: "product-1",
      location: "retail",
      quantity: 2,
      unit_price: 12.5,
      payment_method: "cash",
      note: "Venta de shampoo",
    });

    expect(result).toEqual({ ok: true, value: "Venta registrada." });
    expect(mockedRecordSale).toHaveBeenCalledWith("salon-1", {
      customer_id: null,
      product_id: "product-1",
      location: "retail",
      quantity: 2,
      unit_price: 12.5,
      payment_method: "cash",
      note: "Venta de shampoo",
    });
  });

  it("preserves database error messages when a retail sale fails", async () => {
    mockedRecordSale.mockRejectedValue({ message: "Stock insuficiente para completar la venta." });

    const result = await createRetailSale("salon-1", {
      customer_id: "",
      product_id: "product-1",
      location: "retail",
      quantity: 10,
      unit_price: 12.5,
      payment_method: "cash",
      note: "",
    });

    expect(result).toEqual({
      ok: false,
      error: "Stock insuficiente para completar la venta.",
    });
  });

  it("loads the narrow retail product view on the retail page", async () => {
    mockedGetRetailInventoryProducts.mockResolvedValue([
      {
        id: "active-retail",
        name: "Shampoo",
        category: "Cabello",
        salePrice: 12,
        stock: [],
      },
    ]);
    mockedFindCustomers.mockResolvedValue({
      data: [{ id: "customer-1", first_name: "Ana", last_name: "Mora" }],
    } as Awaited<ReturnType<typeof findCustomers>>);
    mockedRecentSales.mockResolvedValue([]);

    const page = await getRetailPage("salon-1");

    expect(page.products.map((product) => product.id)).toEqual(["active-retail"]);
    expect(page.customers).toEqual([{ id: "customer-1", name: "Ana Mora" }]);
  });
});
