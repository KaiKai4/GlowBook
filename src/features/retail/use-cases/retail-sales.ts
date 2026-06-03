import { findCustomers } from "@/features/customers/data/customers.repo";
import {
  getRetailInventoryProducts,
  type RetailInventoryProductView,
} from "@/features/inventory/use-cases/retail-inventory-products";
import { getErrorMessage } from "@/lib/errors";
import { ok, type Result } from "@/lib/result";
import type { RetailSaleInput } from "../schemas";
import { findRecentRetailSales, recordRetailSaleAtomically } from "../data/retail.repo";

export interface RetailCustomerOption {
  id: string;
  name: string;
}

export interface RetailPageView {
  products: RetailInventoryProductView[];
  customers: RetailCustomerOption[];
  recentSales: Awaited<ReturnType<typeof findRecentRetailSales>>;
}

export async function getRetailPage(salonId: string): Promise<RetailPageView> {
  const [products, customersPage, recentSales] = await Promise.all([
    getRetailInventoryProducts(salonId),
    findCustomers(salonId, { perPage: 100, isActive: true }),
    findRecentRetailSales(salonId),
  ]);

  return {
    products,
    customers: customersPage.data.map((customer) => ({
      id: customer.id,
      name: `${customer.first_name} ${customer.last_name}`.trim(),
    })),
    recentSales,
  };
}

export async function createRetailSale(
  salonId: string,
  input: RetailSaleInput
): Promise<Result<string>> {
  try {
    await recordRetailSaleAtomically(salonId, {
      customer_id: input.customer_id || null,
      product_id: input.product_id,
      location: input.location,
      quantity: input.quantity,
      unit_price: input.unit_price,
      payment_method: input.payment_method,
      note: input.note,
    });

    return ok("Venta registrada.");
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "No se pudo registrar la venta.") };
  }
}
