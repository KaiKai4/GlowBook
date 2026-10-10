import { getActiveCustomerOptions, type CustomerOptionView } from "@/features/customers";
import { getRetailInventoryProducts, type RetailInventoryProductView } from "@/features/inventory";
import { toPublicErrorMessage } from "@/infra/errors";
import { ok, type Result } from "@/infra/result";
import { getSalonPaymentMethods } from "@/features/salon";
import type { PaymentMethodOption } from "@/features/payments";
import type { RetailSaleInput } from "../schemas";
import { findRecentRetailSales } from "../data/retail.repo";
import {
  recordRetailSaleRpc,
  type RecordRetailSaleRpcInput,
} from "../data/rpc/record-retail-sale";

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

/** Dependencias de la venta. Producción usa el adaptador RPC; los tests inyectan fakes. */
export interface CreateRetailSaleDeps {
  recordSaleRpc: (input: RecordRetailSaleRpcInput) => Promise<string>;
}

const defaultCreateRetailSaleDeps: CreateRetailSaleDeps = {
  recordSaleRpc: recordRetailSaleRpc,
};

/** Registra la venta. idempotencyKey evita duplicar la venta si el formulario se reenvia. */
export async function createRetailSale(
  salonId: string,
  input: RetailSaleInput,
  idempotencyKey: string,
  deps: CreateRetailSaleDeps = defaultCreateRetailSaleDeps
): Promise<Result<string>> {
  try {
    await deps.recordSaleRpc({
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
