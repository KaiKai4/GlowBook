import "server-only";

import { captureError } from "@/infra/observability";
import { SALON_FEATURES, type SalonFeatureKey } from "@/features/salon-features";
import {
  COMMERCIAL_PLAN_STATUSES,
  PLAN_ALERT_SEVERITIES,
  PLAN_ALERT_STATUSES,
  PLAN_ENFORCEMENT_MODES,
  PLAN_LIMIT_COUNT_SCOPES,
  PLAN_OVERRIDE_STATUSES,
  SALON_PLAN_ASSIGNMENT_STATUSES,
  USAGE_COUNTER_KEYS,
  type UsageCounterKey,
} from "../domain/commercial-plan";
import { COMMERCIAL_ADDON_KINDS, COMMERCIAL_ADDON_STATUSES } from "../domain/salon-extras";

// La BD guarda estos valores como texto; aquí se convierten a los tipos de dominio.
// Las listas vienen del dominio (fuente única). Un valor fuera de la lista falla
// con un mensaje interno (la BD tiene restricciones).

/** Devuelve el valor si pertenece a la lista; si no, falla. */
function parseOneOf<const T extends string>(allowed: readonly T[], value: string, campo: string): T {
  const found = allowed.find((item) => item === value);
  if (found === undefined) throw new Error(`Valor inesperado en ${campo}: ${value}`);
  return found;
}

export const parsePlanStatus = (value: string) => parseOneOf(COMMERCIAL_PLAN_STATUSES, value, "commercial_plans.status");
export const parseAssignmentStatus = (value: string) =>
  parseOneOf(SALON_PLAN_ASSIGNMENT_STATUSES, value, "salon_plan_assignments.status");
export const parseOverrideStatus = (value: string) =>
  parseOneOf(PLAN_OVERRIDE_STATUSES, value, "salon_plan_overrides.status");
export const parseEnforcementMode = (value: string) =>
  parseOneOf(PLAN_ENFORCEMENT_MODES, value, "enforcement_mode");
export const parseCountScope = (value: string) => parseOneOf(PLAN_LIMIT_COUNT_SCOPES, value, "count_scope");
export const parseCounterKey = (value: string): UsageCounterKey => parseOneOf(USAGE_COUNTER_KEYS, value, "counter_key");
export const parseAddonKind = (value: string) => parseOneOf(COMMERCIAL_ADDON_KINDS, value, "commercial_addons.kind");
export const parseAddonStatus = (value: string) =>
  parseOneOf(COMMERCIAL_ADDON_STATUSES, value, "commercial_addons.status");
export const parseAlertSeverity = (value: string) =>
  parseOneOf(PLAN_ALERT_SEVERITIES, value, "salon_plan_alerts.severity");
export const parseAlertStatus = (value: string) => parseOneOf(PLAN_ALERT_STATUSES, value, "salon_plan_alerts.status");

/** Clave de módulo del catálogo de funciones del salón, o null si no existe. */
function featureKeyOrNull(value: string): SalonFeatureKey | null {
  return SALON_FEATURES.find((feature) => feature.key === value)?.key ?? null;
}

/** Clave de módulo del catálogo de funciones del salón. Una clave desconocida falla. */
export function parseFeatureKey(value: string, campo: string): SalonFeatureKey {
  const found = featureKeyOrNull(value);
  if (found === null) throw new Error(`Valor inesperado en ${campo}: ${value}`);
  return found;
}

// Claves ya reportadas: cada clave desconocida se registra una sola vez por proceso.
const reportedUnknownKeys = new Set<string>();

/**
 * Mapeo de módulos de un plan. La BD no restringe las claves de módulo de un
 * plan, así que una clave retirada (p. ej. un módulo eliminado del catálogo) se
 * descarta registrando el error una vez, sin tumbar la página.
 */
export function parsePlanModuleKeys(values: readonly string[], campo: string): SalonFeatureKey[] {
  const keys: SalonFeatureKey[] = [];
  for (const key of values) {
    const found = featureKeyOrNull(key);
    if (found) {
      keys.push(found);
      continue;
    }
    const signature = `${campo}:${key}`;
    if (reportedUnknownKeys.has(signature)) continue;
    reportedUnknownKeys.add(signature);
    captureError(new Error(`Clave de módulo desconocida en ${campo}: ${key}`), {
      module: "billing",
      action: "parse-plan-module",
    });
  }
  return keys;
}
