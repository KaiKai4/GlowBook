import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { createSupabaseServerClient } from "@/infra/supabase/server";

// Dos clientes para billing (ADR 0010 y ADR 0001). Cada lectura o escritura elige uno.
//
// billingDb() (service_role, bypasa RLS). Solo para plataforma (/admin: suscripciones,
// detalle, extras, pagos, notas, alta de planes) y flujos sin sesión de salón (alta por
// invitación). Las escrituras de plataforma filtran siempre por salon_id.
//   Lecturas: findSubscriptionRows, findPlanCatalog, findCommercialAddons, findAssignmentStartsAt,
//   findAssignmentForPayment, findSalonPayments, findOpenSalonAlerts,
//   findEffectivePlanRowsForPlatform (columnas completas, incluido reason/notes/precio),
//   findPlanWithChildren, countPlanAssignments.
//   Escrituras: saveCommercialPlan, savePlanModule, savePlanLimit, archiveCommercialPlan,
//   deleteCommercialPlan, addons, recordSalonPlanPayment, activatePaidPeriod, assignSalonPlan,
//   saveSalonPlanOverride, updateSalonPlanOverrideStatus, resolvePlanAlert.
//
// billingSalonDb() (cliente del usuario de la sesión, RLS). Solo para el propio salón,
// en el composition root y en los casos de uso del salón (módulos y límites del plan):
//   Lecturas: findEffectivePlanRowsForSalon (metricas, plan asignado, módulos/limites, overrides
//   y asignacion en las columnas concedidas), hasOpenPlanAlert.
//   Escrituras: recordPlanAlert (RPC record_plan_alert, crea la alerta en el salón de la sesion).
//   El conteo de uso va con count_salon_usage (security definer con guarda) desde ambos.
//
// Columnas que el salón NO puede leer (migración 073): overrides.reason, overrides.price_override,
// overrides.is_gift, assignments.notes, pagos completos. Esas lecturas van solo por service_role.
export function billingDb() {
  return createSupabaseAdminClient();
}

export async function billingSalonDb() {
  return createSupabaseServerClient();
}

export type BillingDb = ReturnType<typeof billingDb>;

/** Lanza el error original de la base si la consulta falla; si no, devuelve las filas (o []). */
export function rowsOrThrow<T>(result: { data: T[] | null; error: PostgrestError | null }): T[] {
  if (result.error) throw result.error;
  return result.data ?? [];
}

/** Lanza el error original de la base si la consulta falla; si no, devuelve el conteo (o 0). */
export function countOrThrow(result: { count: number | null; error: PostgrestError | null }): number {
  if (result.error) throw result.error;
  return result.count ?? 0;
}

/** Lanza el error original de la base si la escritura falla. */
export function throwOnError(result: { error: PostgrestError | null }): void {
  if (result.error) throw result.error;
}

/**
 * Escritura de plataforma sobre una fila concreta: el UPDATE con filtro de salón debe
 * afectar exactamente una fila. Cero filas (otro salón o id inexistente) o varias
 * (filtro ambiguo) son error, nunca éxito silencioso.
 */
export function expectOneUpdatedRow(result: { data: { id: string }[] | null; error: PostgrestError | null }, what: string): void {
  if (result.error) throw result.error;
  const updated = result.data?.length ?? 0;
  if (updated !== 1) throw new Error(`Se esperaba actualizar 1 ${what} y se actualizaron ${updated}.`);
}
