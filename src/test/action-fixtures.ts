// Fixtures compartidas por los tests de server actions.
// Construyen un perfil con la forma real de ProfileWithRole para que los
// guards de permisos (hasPermission) se evalúen de verdad, sin mocks.
import { getDisabledSalonFeatures, getPermissions, type Permission } from "@/features/access";
import type { ActionContext } from "@/features/access";
import type { ProfileWithRole } from "@/types/app.types";

export const SALON_ID = "00000000-0000-4000-8000-000000000001";
export const USER_ID = "00000000-0000-4000-8000-0000000000aa";
export const RECORD_ID = "00000000-0000-4000-8000-0000000000bb";

interface ProfileOptions {
  permissions?: readonly Permission[];
  isOwner?: boolean;
  disabledFeatures?: string[];
}

export function buildProfile(options: ProfileOptions = {}): ProfileWithRole {
  return {
    id: USER_ID,
    salon_id: SALON_ID,
    role_id: options.isOwner ? null : "role-1",
    is_owner: options.isOwner ?? false,
    full_name: "Usuario de prueba",
    is_active: true,
    salon: { disabled_features: options.disabledFeatures ?? [] },
    role: {
      id: "role-1",
      name: "Rol de prueba",
      role_permissions: (options.permissions ?? []).map((key) => ({
        permission: { id: key, key, description: key },
      })),
    },
  };
}

/** Construye FormData a partir de un objeto plano de strings. */
export function formDataOf(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

/**
 * Contexto minimo que el composition root entrega a los casos de uso, derivado del
 * perfil de prueba (mismos permisos y módulos que evaluaria el composition root).
 */
export function contextFromProfile(profile: ProfileWithRole): ActionContext {
  return {
    userId: profile.id,
    salonId: profile.salon_id,
    permissions: getPermissions(profile),
    requestId: "req-test",
    rolesEnabled: !getDisabledSalonFeatures(profile).includes("roles"),
  };
}

/** Mismo perfil con el modulo de roles deshabilitado en el plan. */
export function rolesDisabled(profile: ProfileWithRole): ProfileWithRole {
  return { ...profile, salon: { ...profile.salon, disabled_features: ["roles"] } };
}
