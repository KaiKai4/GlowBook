import { requireActiveProfile } from "@/app/_composition/request-context";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import type { Result } from "@/infra/result";

// Roles deshabilitados en el plan: las acciones de rol no se ejecutan.
export function requireRolesEnabled(rolesEnabled: boolean): Result<void> {
  if (rolesEnabled) return { ok: true, value: undefined };
  return { ok: false, error: "Los roles estan deshabilitados para este salon." };
}

// Guardia de las acciones de colaboradores: permiso, limite de peticiones y
// modulo de roles. Vive aparte para mantener actions.ts bajo el limite de lineas.
export async function guard(): Promise<Result<{ salonId: string; rolesEnabled: boolean }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar colaboradores." };
  }

  // Estas acciones crean cuentas Auth y enlaces de acceso: un límite por
  // usuario evita generacion masiva automatizada.
  const limited = await assertActionRateLimit(profile.id, "employees", { max: 30, windowMs: 60_000 });
  if (!limited.ok) return limited;

  return {
    ok: true,
    value: {
      salonId: profile.salon_id,
      rolesEnabled: await isEffectiveSalonModuleEnabled(profile, "roles"),
    },
  };
}
