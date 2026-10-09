import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { CreateCustomerInput } from "@/features/customers/schemas";
import { err, type Result } from "@/infra/result";
import { createCustomerProfile } from "./customer-profile";

/**
 * Da de alta el cliente solo si el plan del salon incluye el modulo de clientes y
 * queda cupo de clientes activos.
 */
export async function createCustomerGuarded(salonId: string, input: CreateCustomerInput): Promise<Result<string>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "customers" });
  if (!moduleAccess.ok) return err(moduleAccess.error);

  const limit = await checkPlanLimit({ salonId, metricKey: "customers.active" });
  if (!limit.ok) return err(limit.error);

  return createCustomerProfile(salonId, input);
}
