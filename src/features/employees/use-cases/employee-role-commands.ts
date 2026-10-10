import { changeEmployeeRole } from "./employee-role";
import { createEmployeeInviteForExistingEmployee } from "./employee-invitation-issue";
import { resetEmployeeAccess } from "./employee-revocation";
import { err, type Result } from "@/infra/result";

const ROLES_DISABLED_MESSAGE = "Los roles estan deshabilitados para este salon.";

/** Comprobacion comun: las operaciones de rol solo existen si el plan incluye roles. */
function requireRolesEnabled(rolesEnabled: boolean): Result<void> {
  if (rolesEnabled) return { ok: true, value: undefined };
  return err(ROLES_DISABLED_MESSAGE);
}

export interface RoleGate {
  salonId: string;
  rolesEnabled: boolean;
}

export async function changeEmployeeRoleFlow(
  gate: RoleGate,
  input: { profileId: string; roleId: string | null }
): Promise<Result<void>> {
  const roles = requireRolesEnabled(gate.rolesEnabled);
  if (!roles.ok) return roles;

  return changeEmployeeRole(gate.salonId, input.profileId, input.roleId);
}

export async function resetEmployeeAccessFlow(
  gate: RoleGate,
  input: { employeeId: string; roleId: string | null }
): Promise<Result<{ token: string; expiresAt: string }>> {
  const roles = requireRolesEnabled(gate.rolesEnabled);
  if (!roles.ok) return roles;

  return resetEmployeeAccess({
    employeeId: input.employeeId,
    salonId: gate.salonId,
    roleId: input.roleId || null,
  });
}

/**
 * Invitacion de acceso para un colaborador existente. Un acceso propio nuevo
 * consume el cupo de usuarios con login del plan (chequeo inyectado).
 */
export async function generateEmployeeInviteFlow(
  gate: RoleGate & { checkLoginLimit: () => Promise<Result<void>> },
  input: { employeeId: string; roleId: string | null }
): Promise<Result<{ token: string; expiresAt: string }>> {
  const roles = requireRolesEnabled(gate.rolesEnabled);
  if (!roles.ok) return roles;
  const limit = await gate.checkLoginLimit();
  if (!limit.ok) return err(limit.error);

  return createEmployeeInviteForExistingEmployee({
    employeeId: input.employeeId,
    salonId: gate.salonId,
    roleId: input.roleId || null,
  });
}
