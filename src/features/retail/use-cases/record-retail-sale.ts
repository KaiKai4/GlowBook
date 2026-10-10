import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { assertSalonPaymentMethodEnabled } from "@/features/salon";
import { err, type Result } from "@/infra/result";
import type { RetailSaleInput } from "../schemas";
import { createRetailSale } from "./retail-sales";

// Venta de vitrina con sus reglas: modulo habilitado, cupo del plan y metodo de
// pago habilitado por el salón. Todo se valida antes de registrar la venta.

/** Dependencias de la venta con reglas. Producción usa los casos reales; los tests inyectan fakes. */
export interface CreateRetailSaleWithPlanLimitsDeps {
  checkModuleAccess: typeof checkPlanModuleAccess;
  checkLimit: typeof checkPlanLimit;
  isPaymentMethodEnabled: typeof assertSalonPaymentMethodEnabled;
  createSale: typeof createRetailSale;
}

// Los accesos a otros modulos van dentro de cada funcion: otros tests los mockean parcialmente.
const defaultCreateRetailSaleWithPlanLimitsDeps: CreateRetailSaleWithPlanLimitsDeps = {
  checkModuleAccess: (input) => checkPlanModuleAccess(input),
  checkLimit: (input) => checkPlanLimit(input),
  isPaymentMethodEnabled: assertSalonPaymentMethodEnabled,
  createSale: (salonId, input, idempotencyKey) => createRetailSale(salonId, input, idempotencyKey),
};

export async function createRetailSaleWithPlanLimits(
  salonId: string,
  input: RetailSaleInput,
  idempotencyKey: string,
  deps: CreateRetailSaleWithPlanLimitsDeps = defaultCreateRetailSaleWithPlanLimitsDeps
): Promise<Result<string>> {
  const moduleAccess = await deps.checkModuleAccess({ salonId, moduleKey: "retail" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await deps.checkLimit({ salonId, metricKey: "retail.sales" });
  if (!limit.ok) return err(limit.error);

  const paymentEnabled = await deps.isPaymentMethodEnabled(salonId, input.payment_method);
  if (!paymentEnabled) {
    return err("Ese método de pago no está habilitado para este salón.");
  }

  return deps.createSale(salonId, input, idempotencyKey);
}
