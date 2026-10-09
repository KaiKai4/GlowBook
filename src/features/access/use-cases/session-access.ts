import "server-only";
import type { ProfileWithRole } from "@/types/app.types";
import { findSalonAccessState, findSessionProfile } from "../data/session-profile.repo";

/** Carga el perfil de la sesion (sin aplicar el plan comercial: eso lo hace el composition root). */
export async function loadSessionProfile(userId: string): Promise<ProfileWithRole | null> {
  return findSessionProfile(userId);
}

/** Estado del salon del perfil: null si el salon no existe. */
export async function loadSalonAccessState(
  salonId: string
): Promise<{ id: string; is_active: boolean } | null> {
  return findSalonAccessState(salonId);
}
