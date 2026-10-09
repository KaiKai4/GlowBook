import "server-only";

// Fachada: los consumidores importan desde aquí; la implementación está
// dividida por responsabilidad (lecturas, escrituras, uso y filas).
export {
  findSubscriptionRows,
  findEffectivePlanRows,
  findAssignmentStartsAt,
  findAssignmentForPayment,
  findSalonPayments,
  findOpenSalonAlerts,
} from "./salon-subscriptions-reads.repo";
export {
  recordSalonPlanPayment,
  activatePaidPeriod,
  assignSalonPlan,
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
  recordPlanAlert,
  resolvePlanAlert,
  hasOpenPlanAlert,
} from "./salon-subscriptions-writes.repo";
