import { generateInvitationToken } from "@/infra/auth/invitation-tokens";
import { findEmployeeById } from "@/features/employees/data/employees.repo";
import { captureError } from "@/infra/observability";
import {
  deleteEmployeeInvitations,
  deletePendingEmployeeInvitations,
  findAssignableEmployeeRole,
  findEmployeeAccessProfile,
  insertEmployeeInvitation,
  unlinkEmployeeProfile,
  updateEmployeeProfileRole,
} from "@/features/employees/data/employee-access.repo";
import { deleteEmployeeAuthUser } from "@/features/employees/data/employee-auth.repo";
import { ok, type Result } from "@/infra/result";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";

export interface EmployeeInviteResult {
  token: string;
  expiresAt: string;
}

async function validateAssignableRoleId(
  salonId: string,
  roleId: string | null
): Promise<Result<string | null>> {
  if (!roleId) return { ok: true, value: null };

  const { data, error } = await findAssignableEmployeeRole(salonId, roleId);

  if (error) {
    captureError(error, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo verificar el rol del colaborador." };
  }

  if (!data) {
    return { ok: false, error: "El rol seleccionado no es valido para este salon." };
  }

  return { ok: true, value: data.id };
}

export async function replacePendingEmployeeInvitation({
  employeeId,
  salonId,
  email,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  email: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  const assignableRole = await validateAssignableRoleId(salonId, roleId);
  if (!assignableRole.ok) return assignableRole;

  const { error: deleteInviteError } = await deletePendingEmployeeInvitations(
    employeeId,
    salonId
  );

  if (deleteInviteError) {
    captureError(deleteInviteError, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo invalidar el enlace anterior del colaborador." };
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: inviteError } = await insertEmployeeInvitation({
    employee_id: employeeId,
    salon_id: salonId,
    email,
    role_id: assignableRole.value,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (inviteError) {
    captureError(inviteError, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo generar el nuevo enlace de acceso." };
  }

  return { ok: true, value: { token, expiresAt } };
}

export async function generateEmployeeInvitation({
  employeeId,
  salonId,
  email,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  email: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  return replacePendingEmployeeInvitation({
    employeeId,
    salonId,
    email,
    roleId,
  });
}

const OWNER_ACCESS_MESSAGE = "No se puede modificar el acceso de un owner desde colaboradores.";

/**
 * Validacion previa a cualquier escritura: el perfil vinculado existe en el salon y no es owner.
 * No escribe nada ni toca Auth.
 */
export async function checkEmployeeAccessRevocable(
  profileId: string,
  salonId: string
): Promise<Result<{ roleId: string | null }>> {
  const { data: linkedProfile, error: profileError } = await findEmployeeAccessProfile(
    profileId,
    salonId
  );

  if (profileError) {
    captureError(profileError, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo verificar el acceso actual del colaborador." };
  }

  if (linkedProfile?.is_owner) return { ok: false, error: OWNER_ACCESS_MESSAGE };

  return { ok: true, value: { roleId: linkedProfile?.role_id ?? null } };
}

/** Borra la cuenta de Auth. Debe llamarse DESPUES de escribir en BD: si falla, el llamador avisa. */
export async function deleteEmployeeAuthAccount(profileId: string): Promise<Result<void>> {
  const { error } = await deleteEmployeeAuthUser(profileId);
  if (error) {
    captureError(error, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo revocar la cuenta anterior del colaborador." };
  }

  return { ok: true, value: undefined };
}

/** Escritura en BD: elimina las invitaciones del colaborador dentro del salon. */
export async function clearEmployeeInvitations(
  employeeId: string,
  salonId: string
): Promise<Result<void>> {
  const { error } = await deleteEmployeeInvitations(employeeId, salonId);
  if (error) {
    captureError(error, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo limpiar la invitación del colaborador." };
  }

  return { ok: true, value: undefined };
}

/**
 * Reinicio de acceso: valida, desvincula en BD y despues borra la cuenta de Auth.
 * Si Auth falla tras la BD, devuelve ok con aviso (la BD ya no tiene profile_id).
 */
export async function unlinkEmployeeAccessForReset(
  employeeId: string,
  salonId: string,
  profileId: string
): Promise<Result<{ roleId: string | null; warnings: string[] }>> {
  const checked = await checkEmployeeAccessRevocable(profileId, salonId);
  if (!checked.ok) return checked;

  const { error: unlinkError } = await unlinkEmployeeProfile(employeeId, salonId);
  if (unlinkError) {
    captureError(unlinkError, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo desvincular el colaborador de su cuenta anterior." };
  }

  const deleted = await deleteEmployeeAuthAccount(profileId);
  return {
    ok: true,
    value: {
      roleId: checked.value.roleId,
      warnings: deleted.ok ? [] : [OLD_ACCOUNT_NOT_DELETED_WARNING],
    },
  };
}

export async function changeEmployeeRole(
  salonId: string,
  profileId: string,
  roleId: string | null
): Promise<Result<void>> {
  const assignableRole = await validateAssignableRoleId(salonId, roleId);
  if (!assignableRole.ok) return assignableRole;

  const { error } = await updateEmployeeProfileRole(
    profileId,
    salonId,
    assignableRole.value
  );

  if (error) {
    captureError(error, { module: "employees", action: "access" });
    return { ok: false, error: "Error al cambiar el rol." };
  }

  return { ok: true, value: undefined };
}

export async function resetEmployeeAccess({
  employeeId,
  salonId,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  const employee = await findEmployeeById(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  const email = employee.email?.trim();
  if (!email) return { ok: false, error: "Este colaborador no tiene email registrado." };

  let inviteRoleId = roleId || null;
  const warnings: string[] = [];
  if (employee.profile_id) {
    const unlinked = await unlinkEmployeeAccessForReset(employeeId, salonId, employee.profile_id);
    if (!unlinked.ok) return unlinked;
    inviteRoleId = inviteRoleId || unlinked.value.roleId;
    warnings.push(...unlinked.value.warnings);
  }

  const invite = await replacePendingEmployeeInvitation({
    employeeId,
    salonId,
    email,
    roleId: inviteRoleId,
  });
  if (!invite.ok) return invite;
  return ok(invite.value, warnings);
}

export async function createEmployeeInviteForExistingEmployee({
  employeeId,
  salonId,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  const employee = await findEmployeeById(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };
  if (!employee.email?.trim()) return { ok: false, error: "Este colaborador no tiene email registrado." };
  if (employee.profile_id) return { ok: false, error: "Este colaborador ya tiene acceso al sistema." };

  return generateEmployeeInvitation({
    employeeId,
    salonId,
    email: employee.email.trim(),
    roleId: roleId || null,
  });
}
