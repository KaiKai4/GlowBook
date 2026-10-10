import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRetailSale, getRetailPage, type CreateRetailSaleDeps } from "./retail-sales";
import { getActiveCustomerOptions } from "@/features/customers/use-cases/customer-options";
import { getRetailInventoryProducts } from "@/features/inventory/use-cases/retail-inventory-products";
import { getSalonPaymentMethods } from "@/features/salon/use-cases/salon-payment-methods";
import { findRecentRetailSales } from "../data/retail.repo";

vi.mock("@/features/customers/use-cases/customer-options", () => ({
  getActiveCustomerOptions: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/retail-inventory-products", () => ({
  getRetailInventoryProducts: vi.fn(),
}));

vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  getSalonPaymentMethods: vi.fn(),
}));

vi.mock("../data/retail.repo", () => ({
  findRecentRetailSales: vi.fn(),
}));

const KEY = "00000000-0000-4000-8000-0000000000c1";

const recordSaleRpc = vi.fn<CreateRetailSaleDeps["recordSaleRpc"]>();
const deps: CreateRetailSaleDeps = { recordSaleRpc };

const mockedGetActiveCustomerOptions = vi.mocked(getActiveCustomerOptions);
const mockedGetRetailInventoryProducts = vi.mocked(getRetailInventoryProducts);
const mockedGetSalonPaymentMethods = vi.mocked(getSalonPaymentMethods);
const mockedRecentSales = vi.mocked(findRecentRetailSales);

const sale = {
  customer_id: "",
  product_id: "product-1",
  location: "retail" as const,
  quantity: 2,
  unit_price: 12.5,
  payment_method: "cash",
  note: "Venta de shampoo",
  idempotency_key: KEY,
};

describe("retail sales use-cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra la venta con el adaptador RPC y reenvia la clave de idempotencia", async () => {
    recordSaleRpc.mockResolvedValue("sale-1");

    const result = await createRetailSale("salon-1", sale, KEY, deps);

    expect(result).toEqual({ ok: true, value: "Venta registrada." });
    expect(recordSaleRpc).toHaveBeenCalledWith({
      salonId: "salon-1",
      customerId: null,
      productId: "product-1",
      location: "retail",
      quantity: 2,
      unitPrice: 12.5,
      paymentMethod: "cash",
      note: "Venta de shampoo",
      idempotencyKey: KEY,
    });
  });

  it("envia la misma clave cuando el formulario se reenvia", async () => {
    recordSaleRpc.mockResolvedValue("sale-1");

    await createRetailSale("salon-1", sale, KEY, deps);
    await createRetailSale("salon-1", sale, KEY, deps);

    expect(recordSaleRpc.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([KEY, KEY]);
  });

  it("preserves our own RAISE messages (SQLSTATE P0001) when a retail sale fails", async () => {
    recordSaleRpc.mockRejectedValue({ code: "P0001", message: "Stock insuficiente para completar la venta." });

    const result = await createRetailSale("salon-1", { ...sale, quantity: 10, note: "" }, KEY, deps);

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
    mockedGetActiveCustomerOptions.mockResolvedValue([{ id: "customer-1", name: "Ana Mora" }]);
    mockedRecentSales.mockResolvedValue([]);
    mockedGetSalonPaymentMethods.mockResolvedValue({
      enabled: ["cash"],
      options: [{ value: "cash", label: "Efectivo" }],
    });

    const page = await getRetailPage("salon-1");

    expect(page.products.map((product) => product.id)).toEqual(["active-retail"]);
    expect(page.customers).toEqual([{ id: "customer-1", name: "Ana Mora" }]);
    expect(page.paymentMethodOptions).toEqual([{ value: "cash", label: "Efectivo" }]);
    expect(mockedGetActiveCustomerOptions).toHaveBeenCalledWith("salon-1", 100);
  });
});
