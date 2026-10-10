// Interfaz pública del módulo de dashboard. La app importa desde aquí;
// `domain/dashboard-money` es puro y también puede usarse desde la página.
export { getDashboardOverview } from "./use-cases/get-dashboard-overview";
export type {
  MonthlyAppointmentPoint,
  PendingAppointmentConfirmation,
  TopService,
} from "./use-cases/get-dashboard-overview";
export { getOnboardingChecklist } from "./use-cases/get-onboarding-checklist";
export type {
  OnboardingChecklist,
  OnboardingStepKey,
} from "./use-cases/get-onboarding-checklist";
export { selectDashboardMoney } from "./domain/dashboard-money";
