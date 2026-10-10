"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import { RetailSaleSchema, type RetailSaleInput } from "@/features/retail/schemas";
import { createRetailSaleWithPlanLimits } from "@/features/retail/use-cases/retail-sale-writes";
import type { Result } from "@/infra/result";

// Ventas de vitrina: afectan a inventario y reportes ademas de la propia vitrina.
const RETAIL_PATHS = ["/retail", "/inventory", "/reports"] as const;

const createSaleFlow = defineAction<FormData, RetailSaleInput, string>({
  permission: { key: PERMISSIONS.RETAIL_MANAGE, deniedMessage: "No tienes permiso para gestionar vitrina." },
  rateLimit: { scope: "retail", options: RATE_LIMIT_POLICIES.write },
  parse: (formData) => parseWithSchema(RetailSaleSchema)(Object.fromEntries(formData)),
  run: (input, session) => createRetailSaleWithPlanLimits(session.salonId, input, input.idempotency_key),
  revalidate: () => RETAIL_PATHS,
});

export async function createRetailSaleAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createSaleFlow(formData);
}
