import { checkPlanLimit } from "@/features/billing";
import type { Result } from "@/infra/result";

/** Forma de la comprobación de cupo: los casos de uso la reciben por `deps`. */
export type AssertCustomerQuota = (salonId: string) => Promise<Result<void>>;

/**
 * Comprueba el cupo de clientes activos del plan antes de cualquier escritura que
 * deje un cliente activo: alta, promocion de temporal o reactivacion de archivado.
 * Devuelve el mismo error que el plan produce en el alta.
 */
export async function assertCustomerQuotaAvailable(salonId: string): Promise<Result<void>> {
  return checkPlanLimit({ salonId, metricKey: "customers.active" });
}
