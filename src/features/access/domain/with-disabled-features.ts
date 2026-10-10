import type { ProfileWithRole } from "@/types/app.types";

/**
 * Devuelve una copia del perfil con los módulos desactivados del salón sustituidos.
 * Funcion pura: no toca el perfil original. Es la unica forma de fijar
 * `salon.disabled_features` antes de calcular permisos.
 */
export function withDisabledFeatures(
  profile: ProfileWithRole,
  disabledFeatures: readonly string[]
): ProfileWithRole {
  return { ...profile, salon: { disabled_features: [...disabledFeatures] } };
}
