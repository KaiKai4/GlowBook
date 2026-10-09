import "server-only";

import { err, type Result } from "@/infra/result";
import { createCatalogService } from "./create-service";
import { parseCreateServiceInput, type CreateServiceRaw } from "./service-input";

// Puertas del plan comercial que el caso de uso necesita. Llegan por parametro
// porque el modulo billing solo se consume desde su index publico.
export interface ServicePlanGate {
  checkModuleAccess: (salonId: string) => Promise<Result<void>>;
  checkServiceLimit: (salonId: string) => Promise<Result<void>>;
}

// Orden preservado: modulo del plan, cupo de servicios activos y, despues, la
// validacion de la entrada. Asi un salon sin cupo recibe el mensaje del plan.
export async function createServiceWithPlan(
  salonId: string,
  raw: CreateServiceRaw,
  plan: ServicePlanGate
): Promise<Result<string>> {
  const moduleAccess = await plan.checkModuleAccess(salonId);
  if (!moduleAccess.ok) return err(moduleAccess.error);

  const limit = await plan.checkServiceLimit(salonId);
  if (!limit.ok) return err(limit.error);

  const input = parseCreateServiceInput(raw);
  if (!input.ok) return input;

  return createCatalogService(salonId, input.value);
}
