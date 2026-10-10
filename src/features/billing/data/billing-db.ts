import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { PlatformAdminProof } from "@/infra/auth/platform-admin-proof";

// Dos clientes para billing (ADR 0010 y ADR 0001). Cada lectura o escritura elige uno.
//
// billingDb() (service_role, bypasa RLS). Lo usan dos tipos de funciones:
//   - Plataforma (/admin: suscripciones, detalle, extras, pagos, notas, alta de planes).
//     Reciben `proof: PlatformAdminProof` como primer parametro y obtienen el cliente con
//     platformDb(proof). Solo requirePlatformAdminProof (composition root) puede emitir la
//     prueba (ADR 0028), así que no se pueden llamar sin pasar la guarda de platform admin.
//     Las escrituras de plataforma filtran siempre por salon_id.
//     Exigen prueba: findSubscriptionRows, findPlanCatalog, findCommercialAddons,
//     findCommercialAddonById, countAddonAssignments, findAssignmentStartsAt,
//     findAssignmentForPayment, findSalonPayments, findOpenSalonAlerts,
//     findEffectivePlanRowsForPlatform, findPlanWithChildren, countPlanAssignments, y todas las
//     escrituras de catálogo y de suscripción (saveCommercialPlan, savePlanModule, savePlanLimit,
//     archiveCommercialPlan, deleteCommercialPlan, saveCommercialAddon, archiveCommercialAddon,
//     deleteCommercialAddon, recordSalonPlanPayment, activatePaidPeriod, assignSalonPlan,
//     saveSalonPlanOverride, updateSalonPlanOverrideStatus, resolvePlanAlert).
//   - Sin prueba, solo el flujo de alta por invitación (accept-invitation, ADR 0005). El salón
//     aún no tiene sesión de admin y el token y el email ya están validados en la RPC
//     accept_invitation. Son las únicas funciones sin prueba que usan billingDb():
//     findPlanWithChildrenAtAcceptance y assignSalonPlanAtAcceptance (sufijo explícito).
//     Cualquier otra función nueva con billingDb() debe recibir la prueba.
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
// Guarda de importación: la regla `billing-db-importers` (.dependency-cruiser.cjs) impide
// importar este archivo fuera de los repos de billing (data/*.repo.ts). Los casos de uso y
// los demás módulos no pueden obtener el cliente service_role crudo.
export function billingDb() {
  return createSupabaseAdminClient();
}

/**
 * Cliente service_role de plataforma. Exige la prueba de platform admin (ADR 0028): los repos
 * de plataforma reciben PlatformAdminProof como primer parametro y obtienen el cliente aqui,
 * asi no se puede llamarlos sin pasar por requirePlatformAdminProof (composition root). La
 * prueba solo se importa como tipo fuera de src/infra/auth y src/app/_composition (regla
 * platform-admin-proof-issuer).
 */
export function platformDb(proof: PlatformAdminProof) {
  if (!proof.userId) throw new Error("La prueba de platform admin no identifica a nadie.");
  return billingDb();
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
