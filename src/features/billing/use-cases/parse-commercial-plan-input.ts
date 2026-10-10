import { formFlag, formText, type FormFieldSource } from "@/infra/validation/form-fields";
import type { PlanLimitCountScope } from "../domain/commercial-plan";
import type { saveCommercialAddonConfig } from "./commercial-addons";
import type {
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "./commercial-plans";

// Lectura del formulario del catálogo comercial: convierte los campos crudos en
// la entrada del caso de uso y fija aquí los valores por defecto (estado draft,
// modo warn, umbral 80, ambito current...). Sin I/O: se prueba directamente.

export type SavePlanInput = Parameters<typeof saveCommercialPlanConfig>[1];
export type SavePlanModulesInput = Parameters<typeof saveCommercialPlanModulesBatch>[1];
export type SavePlanLimitsInput = Parameters<typeof saveCommercialPlanLimitsBatch>[1];
export type SaveAddonInput = Parameters<typeof saveCommercialAddonConfig>[1];

/** Id vacio = alta: se normaliza a undefined. */
function optionalText(value: unknown): string | undefined {
  return formText(value) || undefined;
}

export function readSavePlanInput(source: FormFieldSource): SavePlanInput {
  return {
    id: optionalText(source.get("id")),
    name: formText(source.get("name")),
    code: formText(source.get("code")),
    description: formText(source.get("description")),
    monthlyPrice: formText(source.get("monthlyPrice"), "0"),
    currency: formText(source.get("currency"), "USD"),
    trialDays: formText(source.get("trialDays"), "0"),
    status: formText(source.get("status"), "draft") as "draft" | "active" | "archived",
    isPublic: formFlag(source.get("isPublic")),
    sortOrder: formText(source.get("sortOrder"), "0"),
  };
}

export function readSavePlanModulesInput(source: FormFieldSource): SavePlanModulesInput {
  return {
    planId: formText(source.get("planId")),
    allModuleKeys: source.getAll("allModuleKeys").map(String),
    enabledModuleKeys: source.getAll("enabledModuleKeys").map(String),
  };
}

/** Los limites llegan como listas paralelas indexadas por la clave de metrica. */
export function readSavePlanLimitsInput(source: FormFieldSource): SavePlanLimitsInput {
  const metricKeys = source.getAll("metricKey").map(String);
  const maxValues = source.getAll("maxValue");
  const enforcementModes = source.getAll("enforcementMode");
  const warningThresholds = source.getAll("warningThreshold");
  const countScopes = source.getAll("countScope");

  return {
    planId: formText(source.get("planId")),
    limits: metricKeys.map((metricKey, index) => ({
      metricKey,
      maxValue: formText(maxValues[index]),
      enforcementMode: formText(enforcementModes[index], "warn") as "none" | "warn" | "block",
      warningThreshold: formText(warningThresholds[index], "80"),
      countScope: formText(countScopes[index], "current") as PlanLimitCountScope,
    })),
  };
}

export function readSaveAddonInput(source: FormFieldSource): SaveAddonInput {
  return {
    id: optionalText(source.get("id")),
    name: formText(source.get("name")),
    code: formText(source.get("code")),
    description: formText(source.get("description")),
    kind: formText(source.get("kind"), "module") as "module" | "limit_boost",
    moduleKey: optionalText(source.get("moduleKey")),
    metricKey: optionalText(source.get("metricKey")),
    limitDelta: formText(source.get("limitDelta")),
    currency: formText(source.get("currency"), "USD"),
    monthlyPrice: formText(source.get("monthlyPrice"), "0"),
    status: formText(source.get("status"), "active") as "draft" | "active" | "archived",
    sortOrder: formText(source.get("sortOrder"), "0"),
  };
}
