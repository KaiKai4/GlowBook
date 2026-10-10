"use server";

import { definePlatformAction } from "@/app/_composition/define-platform-action";
import { parseUuidField } from "@/app/_composition/define-action";
import { ok } from "@/infra/result";
import {
  archivePlan,
  deletePlan,
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "@/features/billing/use-cases/commercial-plans";
import {
  removeCommercialAddonConfig,
  saveCommercialAddonConfig,
} from "@/features/billing/use-cases/commercial-addons";
import {
  readSaveAddonInput,
  readSavePlanInput,
  readSavePlanLimitsInput,
  readSavePlanModulesInput,
  type SaveAddonInput,
  type SavePlanInput,
  type SavePlanLimitsInput,
  type SavePlanModulesInput,
} from "@/features/billing/use-cases/commercial-plans-form";
import { toPlanActionState, type PlatformPlanActionState } from "./action-state";

const PLAN_PATHS = ["/admin/plans", "/admin/subscriptions", "/"];

const savePlanFlow = definePlatformAction<FormData, SavePlanInput, string>({
  rateLimit: { scope: "admin:savePlanAction" },
  parse: (formData) => ok(readSavePlanInput(formData)),
  run: async (input, session) => {
    const result = await saveCommercialPlanConfig(input, session.userId);
    return result.ok ? ok("Plan guardado.") : result;
  },
  revalidate: () => PLAN_PATHS,
});

export async function savePlanAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await savePlanFlow(formData));
}

const archivePlanFlow = definePlatformAction<string, string, void>({
  rateLimit: { scope: "admin:archivePlanAction" },
  parse: parseUuidField,
  run: async (planId, session) => {
    const result = await archivePlan(planId, session.userId);
    return result.ok ? ok(undefined) : result;
  },
  revalidate: () => PLAN_PATHS,
});

/** Las acciones de borrado lanzan para que el cliente muestre el error. */
export async function archivePlanAction(planId: string): Promise<void> {
  const result = await archivePlanFlow(planId);
  if (!result.ok) throw new Error(result.error);
}

const deletePlanFlow = definePlatformAction<string, string, void>({
  rateLimit: { scope: "admin:deletePlanAction" },
  parse: parseUuidField,
  run: async (planId, session) => {
    const result = await deletePlan(planId, session.userId);
    return result.ok ? ok(undefined) : result;
  },
  revalidate: () => PLAN_PATHS,
});

/** El servidor comprueba las asignaciones: el cliente solo envia el id del plan. */
export async function deletePlanAction(planId: string): Promise<void> {
  const result = await deletePlanFlow(planId);
  if (!result.ok) throw new Error(result.error);
}

const savePlanModulesFlow = definePlatformAction<FormData, SavePlanModulesInput, string>({
  rateLimit: { scope: "admin:savePlanModulesAction" },
  parse: (formData) => ok(readSavePlanModulesInput(formData)),
  run: async (input, session) => {
    const result = await saveCommercialPlanModulesBatch(input, session.userId);
    return result.ok ? ok("Modulos del plan actualizados.") : result;
  },
  revalidate: () => PLAN_PATHS,
});

export async function savePlanModulesAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await savePlanModulesFlow(formData));
}

const savePlanLimitsFlow = definePlatformAction<FormData, SavePlanLimitsInput, string>({
  rateLimit: { scope: "admin:savePlanLimitsAction" },
  parse: (formData) => ok(readSavePlanLimitsInput(formData)),
  run: async (input, session) => {
    const result = await saveCommercialPlanLimitsBatch(input, session.userId);
    return result.ok ? ok("Límites del plan actualizados.") : result;
  },
  revalidate: () => PLAN_PATHS,
});

export async function savePlanLimitsAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await savePlanLimitsFlow(formData));
}

const saveAddonFlow = definePlatformAction<FormData, SaveAddonInput, string>({
  rateLimit: { scope: "admin:saveAddonAction" },
  parse: (formData) => ok(readSaveAddonInput(formData)),
  run: async (input, session) => {
    const result = await saveCommercialAddonConfig(input, session.userId);
    return result.ok ? ok("Extra guardado.") : result;
  },
  revalidate: () => PLAN_PATHS,
});

export async function saveAddonAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await saveAddonFlow(formData));
}

const removeAddonFlow = definePlatformAction<string, string, void>({
  rateLimit: { scope: "admin:removeAddonAction" },
  parse: parseUuidField,
  run: async (addonId, session) => {
    const result = await removeCommercialAddonConfig(addonId, session.userId);
    return result.ok ? ok(undefined) : result;
  },
  revalidate: () => PLAN_PATHS,
});

/** Las acciones de borrado lanzan para que el cliente muestre el error. */
export async function removeAddonAction(addonId: string): Promise<void> {
  const result = await removeAddonFlow(addonId);
  if (!result.ok) throw new Error(result.error);
}
