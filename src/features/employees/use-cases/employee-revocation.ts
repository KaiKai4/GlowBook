import { findEmployeeById } from "@/features/employees/data/employees-read.repo";
import {
  findEmployeeAccessProfile,
  unlinkEmployeeProfile,
} from "@/features/employees/data/employee-access.repo";
import { deleteEmployeeAuthUser } from "@/features/employees/data/employee-auth.repo";
import {
  deletePendingEmployeeInvitations,
  insertEmployeeInvitation,
} from "@/features/employees/data/employee-invitations.repo";
import { captureError } from "@/infra/observability";
import { ok, type Result } from "@/infra/result";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";
import {
  replacePendingEmployeeInvitation,
  type EmployeeAccessLookup,
  type EmployeeInviteResult,
  type ReplacePendingEmployeeInvitationDeps,
} from "./employee-invitation-issue";

// Revocacion y reinicio de acceso: valida el perfil, desvincula en BD y borra la cuenta de Auth.

const OWNER_ACCESS_MESSAGE = "No se puede modificar el acceso de un owner desde colaboradores.";

/** Dependencias de la validación previa: lectura del perfil vinculado. */
export interface CheckEmployeeAccessRevocableDeps {
  findAccessProfile: typeof findEmployeeAccessProfile;
}

const defaultCheckEmployeeAccessRevocableDeps: CheckEmployeeAccessRevocableDeps = {
  findAccessProfile: findEmployeeAccessProfile,
};

/**
 * Validacion previa a cualquier escritura: el perfil vinculado existe en el salón y no es owner.
 * No escribe nada ni toca Auth.
 */
export async function checkEmployeeAccessRevocable(
  profileId: string,
  salonId: string,
  deps: CheckEmployeeAccessRevocableDeps = defaultCheckEmployeeAccessRevocableDeps
): Promise<Result<{ roleId: string | null }>> {
  const { data: linkedProfile, error: profileError } = await deps.findAccessProfile(profileId, salonId);

  if (profileError) {
    captureError(profileError, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo verificar el acceso actual del colaborador." };
  }

  if (linkedProfile?.is_owner) return { ok: false, error: OWNER_ACCESS_MESSAGE };

  return { ok: true, value: { roleId: linkedProfile?.role_id ?? null } };
}

/** Dependencias del borrado de la cuenta de Auth. */
export interface DeleteEmployeeAuthAccountDeps {
  deleteAuthUser: typeof deleteEmployeeAuthUser;
}

const defaultDeleteEmployeeAuthAccountDeps: DeleteEmployeeAuthAccountDeps = {
  deleteAuthUser: deleteEmployeeAuthUser,
};

/** Borra la cuenta de Auth. Debe llamarse DESPUES de escribir en BD: si falla, el llamador avisa. */
export async function deleteEmployeeAuthAccount(
  profileId: string,
  deps: DeleteEmployeeAuthAccountDeps = defaultDeleteEmployeeAuthAccountDeps
): Promise<Result<void>> {
  const { error } = await deps.deleteAuthUser(profileId);
  if (error) {
    captureError(error, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo revocar la cuenta anterior del colaborador." };
  }

  return { ok: true, value: undefined };
}

/** Dependencias del reinicio de acceso: validación, desvinculación, borrado de Auth y nueva invitación. */
export interface ResetEmployeeAccessDeps
  extends CheckEmployeeAccessRevocableDeps,
    DeleteEmployeeAuthAccountDeps,
    ReplacePendingEmployeeInvitationDeps {
  findEmployeeById: (id: string, salonId: string) => Promise<EmployeeAccessLookup | null>;
  unlinkProfile: typeof unlinkEmployeeProfile;
}

const defaultResetEmployeeAccessDeps: ResetEmployeeAccessDeps = {
  findEmployeeById,
  findAccessProfile: findEmployeeAccessProfile,
  unlinkProfile: unlinkEmployeeProfile,
  deleteAuthUser: deleteEmployeeAuthUser,
  deletePendingInvitations: deletePendingEmployeeInvitations,
  insertInvitation: insertEmployeeInvitation,
};

/**
 * Reinicio de acceso: valida, desvincula en BD y despues borra la cuenta de Auth.
 * Si Auth falla tras la BD, devuelve ok con aviso (la BD ya no tiene profile_id).
 */
async function unlinkEmployeeAccessForReset(
  employeeId: string,
  salonId: string,
  profileId: string,
  deps: ResetEmployeeAccessDeps
): Promise<Result<{ roleId: string | null; warnings: string[] }>> {
  const checked = await checkEmployeeAccessRevocable(profileId, salonId, deps);
  if (!checked.ok) return checked;

  const { error: unlinkError } = await deps.unlinkProfile(employeeId, salonId);
  if (unlinkError) {
    captureError(unlinkError, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo desvincular el colaborador de su cuenta anterior." };
  }

  const deleted = await deleteEmployeeAuthAccount(profileId, deps);
  return {
    ok: true,
    value: {
      roleId: checked.value.roleId,
      warnings: deleted.ok ? [] : [OLD_ACCOUNT_NOT_DELETED_WARNING],
    },
  };
}

export async function resetEmployeeAccess(
  {
    employeeId,
    salonId,
    roleId,
  }: {
    employeeId: string;
    salonId: string;
    roleId: string | null;
  },
  deps: ResetEmployeeAccessDeps = defaultResetEmployeeAccessDeps
): Promise<Result<EmployeeInviteResult>> {
  const employee = await deps.findEmployeeById(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  const email = employee.email?.trim();
  if (!email) return { ok: false, error: "Este colaborador no tiene email registrado." };

  let inviteRoleId = roleId || null;
  const warnings: string[] = [];
  if (employee.profile_id) {
    const unlinked = await unlinkEmployeeAccessForReset(employeeId, salonId, employee.profile_id, deps);
    if (!unlinked.ok) return unlinked;
    inviteRoleId = inviteRoleId || unlinked.value.roleId;
    warnings.push(...unlinked.value.warnings);
  }

  const invite = await replacePendingEmployeeInvitation(
    {
      employeeId,
      salonId,
      email,
      roleId: inviteRoleId,
    },
    deps
  );
  if (!invite.ok) return invite;
  return ok(invite.value, warnings);
}
