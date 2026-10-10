// Punto publico del modulo salon. Otros módulos importan solo desde aquí.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { getSalonBusinessHours } from "./use-cases/salon-business-hours";
export { getSalonIdentity } from "./use-cases/salon-identity";
export {
  assertSalonPaymentMethodEnabled,
  getSalonPaymentMethods,
} from "./use-cases/salon-payment-methods";
export { getSalonSchedulingConfig } from "./use-cases/salon-scheduling-config";

export { getOwnerPlanLimitWarnings, getDashboardShell, type DashboardShellViewModel } from "./use-cases/get-dashboard-shell";
export { updateBusinessHours } from "./use-cases/update-business-hours";
export { updateSalonBackground } from "./use-cases/update-salon-background";
export { updateSalonInfo } from "./use-cases/update-salon-info";
export { updateSalonPaymentMethods } from "./use-cases/update-salon-payment-methods";
export { updateSalonTheme } from "./use-cases/update-salon-theme";
export { parseBusinessHoursJson } from "./use-cases/business-hours-input";
export { getSalonActivity, type SalonActivityEntry } from "./use-cases/get-salon-activity";
export { getSalonSettings } from "./use-cases/get-salon-settings";

export type { SalonBusinessDay } from "./use-cases/get-salon-settings";
