import "server-only";

// Fachada: los consumidores importan desde aquí; la implementación está
// dividida por responsabilidad (lecturas, escrituras, uso y filas).
// Cada función elige su cliente: las ...ForSalon usan la sesión del usuario (RLS),
// el resto service_role (plataforma). Ver billing-db.ts.
export {
  findSubscriptionRows,
  findEffectivePlanRowsForPlatform,
  findEffectivePlanRowsForSalon,
  findAssignmentStartsAt,
  findAssignmentForPayment,
  findSalonPayments,
  findOpenSalonAlerts,
} from "./salon-subscriptions-reads.repo";
export {
  recordSalonPlanPayment,
  activatePaidPeriod,
  assignSalonPlan,
  assignSalonPlanAtAcceptance,
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
  recordPlanAlert,
  resolvePlanAlert,
  hasOpenPlanAlert,
} from "./salon-subscriptions-writes.repo";
