// Claves tipadas del plan comercial. Son el contrato entre el codigo y el
// catálogo de la BD (commercial_limit_metrics, migracion 20240101000049): un
// literal mal escrito en una comprobacion de plan no compila.
import type { SalonFeatureKey } from "@/features/salon-features";

/** Modulo que activa una funcion del plan. Mismo catálogo que los módulos del salón. */
export type PlanModuleKey = SalonFeatureKey;

/** Metricas de limite del catálogo comercial (commercial_limit_metrics.key). */
export type PlanMetricKey =
  | "appointments.total"
  | "customers.active"
  | "employees.active"
  | "employees.login_users"
  | "expenses.total"
  | "inventory.movements"
  | "inventory.products"
  | "retail.sales"
  | "services.active";
