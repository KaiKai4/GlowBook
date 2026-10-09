import {
  getActiveCustomerOptions,
  type CustomerOptionView,
} from "@/features/customers/use-cases/customer-options";
import {
  getRetailInventoryProducts,
  type RetailInventoryProductView,
} from "@/features/inventory/use-cases/retail-inventory-products";
import { toPublicErrorMessage } from "@/lib/errors";
import { ok, type Result } from "@/lib/result";
import { getSalonPaymentMethods } from "@/features/salon/use-cases/salon-payment-methods";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";
import type { RetailSaleInput } from "../schemas";
import { findRecentRetailSales } from "../data/retail.repo";
import { recordRetailSaleRpc } from "../data/rpc/record-retail-sale";

export interface RetailPageView {
  products: RetailInventoryProductView[];
  customers: CustomerOptionView[];
  recentSales: Awaited<ReturnType<typeof findRecentRetailSales>>;
  paymentMethodOptions: PaymentMethodOption[];
}

export async function getRetailPage(salonId: string): Promise<RetailPageView> {
  const [products, customers, recentSales, paymentMethods] = await Promise.all([
    getRetailInventoryProducts(salonId),
    getActiveCustomerOptions(salonId, 100),
    findRecentRetailSales(salonId),
    getSalonPaymentMethods(salonId),
  ]);

  return {
    products,
    customers,
    recentSales,
    paymentMethodOptions: paymentMethods.options,
  };
}

/** Registra la venta. idempotencyKey evita duplicar la venta si el formulario se reenvia. */
export async function createRetailSale(
  salonId: string,
  input: RetailSaleInput,
  idempotencyKey: string
): Promise<Result<string>> {
  try {
    await recordRetailSaleRpc({
      salonId,
      customerId: input.customer_id || null,
      productId: input.product_id,
      location: input.location,
      quantity: input.quantity,
      unitPrice: input.unit_price,
      paymentMethod: input.payment_method,
      note: input.note || null,
      idempotencyKey,
    });

    return ok("Venta registrada.");
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error, "No se pudo registrar la venta.") };
  }
}
