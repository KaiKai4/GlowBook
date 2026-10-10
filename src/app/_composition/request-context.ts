import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionUserId } from "@/infra/auth/session";
import { getRequestId } from "@/infra/observability/request-context";
import {
  getPermissions,
  isPlatformAdminUser,
  withDisabledFeatures,
  type ActionContext,
  type RequestContext,
} from "@/features/access";
import {
  loadSalonAccessState,
  loadSessionProfile,
} from "@/features/access/use-cases/session-access";
import { getEffectiveDisabledSalonFeatures, salonModuleScopeFromProfile } from "@/features/billing";
import type { ProfileWithRole } from "@/types/app.types";

// Composition root de la capa de presentacion: el unico sitio que lee la sesion
// y construye el RequestContext. Los casos de uso reciben el contexto minimo
// (ActionContext) por parametro; rutas y acciones solo llaman a estas funciones.
// Todas las lecturas de sesion van memoizadas por peticion con react cache: una
// misma request hace un solo viaje a Auth y una sola consulta de perfil.

/** Id del usuario de la sesion, leido una vez por peticion. */
const getSessionUserId = cache(readSessionUserId);

/** Consulta de platform_admins memoizada por peticion y por usuario. */
const isPlatformAdminCached = cache(isPlatformAdminUser);

/**
 * Contexto de la request actual (memoizado por request con react cache), o null
 * si no hay usuario autenticado o no tiene perfil.
 */
const getRequestContext = cache(async (): Promise<RequestContext | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const row = await loadSessionProfile(userId);
  if (!row) return null;

  // El perfil sale con los modulos efectivos del plan (con fallback
  // a salons.disabled_features si no hay plan): hasPermission y la navegacion
  // deben decidir con la misma fuente, no con la columna legacy a secas.
  const disabledFeatures = await getEffectiveDisabledSalonFeatures(salonModuleScopeFromProfile(row));
  const profile = withDisabledFeatures(row, disabledFeatures);

  return {
    userId,
    salonId: profile.salon_id,
    profile,
    permissions: getPermissions(profile),
    requestId: (await getRequestId()) ?? crypto.randomUUID(),
    // Los modulos deshabilitados ya salen del plan efectivo: el modulo de roles
    // esta activo si no figura en esa lista (mismo criterio que isEffectiveSalonModuleEnabled).
    rolesEnabled: !disabledFeatures.includes("roles"),
  };
});

/** Perfil de la sesion actual, o null si no hay sesion con perfil. */
export async function getProfile(): Promise<ProfileWithRole | null> {
  const context = await getRequestContext();
  return context?.profile ?? null;
}

export async function requireProfile(): Promise<ProfileWithRole> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Contexto de la request con perfil y salon activos. Redirige a /login o a / si
 * el perfil o el salon estan inactivos.
 */
async function requireActiveRequestContext(): Promise<RequestContext> {
  const context = await getRequestContext();
  if (!context) redirect("/login");

  if (!context.profile.is_active) redirect("/login");

  const salon = await loadSalonAccessState(context.salonId);

  if (!salon) redirect("/login");
  if (!salon.is_active) redirect("/");

  return context;
}

export async function requireActiveProfile(): Promise<ProfileWithRole> {
  return (await requireActiveRequestContext()).profile;
}

/** Contexto minimo para los casos de uso de una accion de salon (sin perfil completo). */
export async function requireActionContext(): Promise<ActionContext> {
  const { userId, salonId, permissions, requestId, rolesEnabled } = await requireActiveRequestContext();
  return { userId, salonId, permissions, requestId, rolesEnabled };
}

/** Si el plan del salon incluye el modulo de roles, leido del contexto memoizado de la request. */
export async function getRolesEnabled(): Promise<boolean> {
  const context = await getRequestContext();
  return context?.rolesEnabled ?? false;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const userId = await getSessionUserId();
  if (!userId) return false;
  return isPlatformAdminCached(userId);
}

export async function requirePlatformAdmin(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const isAdmin = await isPlatformAdminCached(userId);
  if (!isAdmin) redirect("/login");
  return userId;
}
