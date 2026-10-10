import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { assertSalonPaymentMethodEnabled } from "@/features/salon";
import { err, type Result } from "@/infra/result";
import type { RetailSaleInput } from "../schemas";
import { createRetailSale } from "./retail-sales";

// Venta de vitrina con sus reglas: modulo habilitado, cupo del plan y metodo de
// pago habilitado por el salon. Todo se valida antes de registrar la venta.

export async function createRetailSaleWithPlanLimits(
  salonId: string,
  input: RetailSaleInput,
  idempotencyKey: string
): Promise<Result<string>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "retail" });
  if (!moduleAccess.ok) return err(moduleAccess.error);
  const limit = await checkPlanLimit({ salonId, metricKey: "retail.sales" });
  if (!limit.ok) return err(limit.error);

  const paymentEnabled = await assertSalonPaymentMethodEnabled(salonId, input.payment_method);
  if (!paymentEnabled) {
    return err("Ese metodo de pago no esta habilitado para este salon.");
  }

  return createRetailSale(salonId, input, idempotencyKey);
}
