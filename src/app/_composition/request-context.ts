import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionUserId, isPlatformAdminUser } from "@/infra/auth/session";
import { getRequestId } from "@/infra/observability/request-context";
import { getPermissions, type RequestContext } from "@/features/access";
import {
  loadSalonAccessState,
  loadSessionProfile,
} from "@/features/access/use-cases/session-access";
import { getEffectiveDisabledSalonFeatures } from "@/features/billing";
import type { ProfileWithRole } from "@/types/app.types";

// Composition root de la capa de presentacion: el unico sitio que lee la sesion
// y construye el RequestContext. Los casos de uso reciben el contexto por
// parametro; rutas y acciones solo llaman a estas funciones.

/**
 * Contexto de la request actual (memoizado por request con react cache), o null
 * si no hay usuario autenticado o no tiene perfil.
 */
const getRequestContext = cache(async (): Promise<RequestContext | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const row = await loadSessionProfile(userId);
  if (!row) return null;

  // El perfil sale con los modulos efectivos del plan comercial (con fallback
  // a salons.disabled_features si no hay plan): hasPermission y la navegacion
  // deben decidir con la misma fuente, no con la columna legacy a secas.
  const disabledFeatures = await getEffectiveDisabledSalonFeatures(row);
  const profile: ProfileWithRole = { ...row, salon: { disabled_features: disabledFeatures } };

  return {
    userId,
    salonId: profile.salon_id,
    profile,
    permissions: getPermissions(profile),
    requestId: (await getRequestId()) ?? crypto.randomUUID(),
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

export async function requireActiveProfile(): Promise<ProfileWithRole> {
  const profile = await requireProfile();

  if (!profile.is_active) redirect("/login");

  const salon = await loadSalonAccessState(profile.salon_id);

  if (!salon) redirect("/login");
  if (!salon.is_active) redirect("/");

  return profile;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const userId = await readSessionUserId();
  if (!userId) return false;
  return isPlatformAdminUser(userId);
}

export async function requirePlatformAdmin(): Promise<string> {
  const userId = await readSessionUserId();
  if (!userId) redirect("/login");

  const isAdmin = await isPlatformAdminUser(userId);
  if (!isAdmin) redirect("/login");
  return userId;
}
