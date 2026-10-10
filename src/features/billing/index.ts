// Punto público del módulo billing. Otros módulos importan solo desde aquí.
// Solo se exporta lo que consumen hoy otros módulos (no re-exportar todo).
// Índice de servidor ("server-only"): importarlo únicamente desde use-cases o
// rutas de servidor, nunca desde componentes cliente.
import "server-only";

export { getPlanCatalogSummary } from "./use-cases/commercial-plans";
export { autoAssignPlanOnAcceptance } from "./use-cases/salon-plan-assignment";
export {
  checkPlanModuleAccess,
  getEffectiveDisabledSalonFeatures,
  getEffectiveSalonPlan,
  isEffectiveSalonModuleEnabled,
  salonModuleScopeFromProfile,
} from "./use-cases/plan-modules";
export { checkPlanLimit } from "./use-cases/plan-limits";
export { readEffectivePlanOrNull } from "./use-cases/effective-plan-fallback";
export { isActionableLimitWarning } from "./domain/commercial-plan";
export { planLimitMessage } from "./messages";
export { evaluatePaymentStanding } from "./domain/payment-standing";
export type { PaymentStanding } from "./domain/payment-standing";

export { getSubscriptionsPage } from "./use-cases/salon-subscriptions-page";
export { archivePlan, deletePlan, saveCommercialPlanConfig, saveCommercialPlanLimitsBatch, saveCommercialPlanModulesBatch, getCommercialPlansPage } from "./use-cases/commercial-plans";
export { removeCommercialAddonConfig, saveCommercialAddonConfig } from "./use-cases/commercial-addons";
export { readSaveAddonInput, readSavePlanInput, readSavePlanLimitsInput, readSavePlanModulesInput, type SaveAddonInput, type SavePlanInput, type SavePlanLimitsInput, type SavePlanModulesInput } from "./use-cases/parse-commercial-plan-input";
export { assignSalonAddonConfig, cancelSalonExtraConfig, saveSalonManualExtraConfig } from "./use-cases/salon-plan-extras";
export { assignSalonCommercialPlanConfig, registerSalonPlanPaymentConfig } from "./use-cases/salon-plan-assignment";
export { resolveSalonPlanAlertConfig } from "./use-cases/plan-limits";
export { getSalonSubscriptionDetail } from "./use-cases/salon-subscription-detail";
export { readAssignPlanInput, readGiveAddonInput, readManualExtraInput, readRegisterPaymentInput, type AssignPlanInput, type GiveAddonInput, type ManualExtraInput, type RegisterPaymentInput } from "./use-cases/parse-salon-subscription-input";

export type { CommercialAddon, CommercialLimitMetric, PlatformModule, CommercialPlan } from "./use-cases/commercial-plans";
export type { SalonSubscriptionDetail, SalonExtraView } from "./use-cases/salon-subscription-detail";
export type { SubscriptionsPageData } from "./use-cases/salon-subscriptions-page";
