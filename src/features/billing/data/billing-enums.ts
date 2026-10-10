import "server-only";

import { SALON_FEATURES, type SalonFeatureKey } from "@/features/salon-features";
import type { UsageCounterKey } from "../domain/commercial-plan";

// La BD guarda estos valores como texto; aquí se convierten a los tipos de dominio.
// Un valor fuera de la lista falla con un mensaje interno (la BD tiene restricciones).

/** Devuelve el valor si pertenece a la lista; si no, falla. */
function parseOneOf<const T extends string>(allowed: readonly T[], value: string, campo: string): T {
  const found = allowed.find((item) => item === value);
  if (found === undefined) throw new Error(`Valor inesperado en ${campo}: ${value}`);
  return found;
}

const PLAN_STATUSES = ["draft", "active", "archived"] as const;
const ASSIGNMENT_STATUSES = ["trialing", "active", "past_due", "paused", "canceled"] as const;
const OVERRIDE_STATUSES = ["active", "paused", "canceled"] as const;
const ENFORCEMENT_MODES = ["none", "warn", "block"] as const;
const COUNT_SCOPES = ["current", "monthly", "billing_cycle", "lifetime"] as const;
const COUNTER_KEYS = [
  "appointments_total",
  "customers_active",
  "employees_active",
  "login_users_total",
  "services_active",
  "retail_sales_total",
  "inventory_products_active",
  "inventory_movements_total",
  "expenses_total",
] as const;
const ADDON_KINDS = ["module", "limit_boost"] as const;
const ADDON_STATUSES = ["draft", "active", "archived"] as const;
const ALERT_SEVERITIES = ["info", "warning", "danger"] as const;
const ALERT_STATUSES = ["open", "acknowledged", "resolved"] as const;

export const parsePlanStatus = (value: string) => parseOneOf(PLAN_STATUSES, value, "commercial_plans.status");
export const parseAssignmentStatus = (value: string) =>
  parseOneOf(ASSIGNMENT_STATUSES, value, "salon_plan_assignments.status");
export const parseOverrideStatus = (value: string) =>
  parseOneOf(OVERRIDE_STATUSES, value, "salon_plan_overrides.status");
export const parseEnforcementMode = (value: string) =>
  parseOneOf(ENFORCEMENT_MODES, value, "enforcement_mode");
export const parseCountScope = (value: string) => parseOneOf(COUNT_SCOPES, value, "count_scope");
export const parseCounterKey = (value: string): UsageCounterKey => parseOneOf(COUNTER_KEYS, value, "counter_key");
export const parseAddonKind = (value: string) => parseOneOf(ADDON_KINDS, value, "commercial_addons.kind");
export const parseAddonStatus = (value: string) =>
  parseOneOf(ADDON_STATUSES, value, "commercial_addons.status");
export const parseAlertSeverity = (value: string) =>
  parseOneOf(ALERT_SEVERITIES, value, "salon_plan_alerts.severity");
export const parseAlertStatus = (value: string) => parseOneOf(ALERT_STATUSES, value, "salon_plan_alerts.status");

/** Clave de módulo del catálogo de funciones del salón. */
export function parseFeatureKey(value: string, campo: string): SalonFeatureKey {
  const found = SALON_FEATURES.find((feature) => feature.key === value)?.key;
  if (found === undefined) throw new Error(`Valor inesperado en ${campo}: ${value}`);
  return found;
}
