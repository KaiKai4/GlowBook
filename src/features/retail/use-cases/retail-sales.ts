import { findCustomers } from "@/features/customers/data/customers.repo";
import { getInventoryPage } from "@/features/inventory/use-cases/inventory-products";
import { adjustInventoryStock } from "@/features/inventory/use-cases/stock-commands";
import { err, ok, type Result } from "@/lib/result";
import type { RetailSaleInput } from "../schemas";
import { findRecentRetailSales, insertRetailSale, insertRetailSaleItem } from "../data/retail.repo";

export interface RetailCustomerOption {
  id: string;
  name: string;
}

export interface RetailPageView {
  products: Awaited<ReturnType<typeof getInventoryPage>>["products"];
  customers: RetailCustomerOption[];
  recentSales: Awaited<ReturnType<typeof findRecentRetailSales>>;
}

export async function getRetailPage(salonId: string): Promise<RetailPageView> {
  const [inventory, customersPage, recentSales] = await Promise.all([
    getInventoryPage(salonId),
    findCustomers(salonId, { perPage: 100, isActive: true }),
    findRecentRetailSales(salonId),
  ]);

  return {
    products: inventory.products.filter((product) => product.isActive && product.isRetailEnabled),
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
    const inventory = await getInventoryPage(salonId);
    const product = inventory.products.find((item) => item.id === input.product_id);
    if (!product?.isRetailEnabled) {
      return err("Este producto no esta habilitado para venta en vitrina.");
    }

    const totalAmount = Number((input.quantity * input.unit_price).toFixed(2));
    const stockResult = await adjustInventoryStock({
      salonId,
      productId: input.product_id,
      location: input.location,
      delta: -input.quantity,
      movementType: "retail_sale",
      note: input.note || "Venta de vitrina",
    });
    if (!stockResult.ok) return stockResult;

    const sale = await insertRetailSale(salonId, {
      customer_id: input.customer_id || null,
      payment_method: input.payment_method,
      total_amount: totalAmount,
      note: input.note,
    });

    await insertRetailSaleItem(salonId, {
      sale_id: sale.id,
      product_id: input.product_id,
      location: input.location,
      quantity: input.quantity,
      unit_price: input.unit_price,
      total_price: totalAmount,
    });

    return ok("Venta registrada.");
  } catch (error) {
    return err(error instanceof Error ? error.message : "No se pudo registrar la venta.");
  }
}
