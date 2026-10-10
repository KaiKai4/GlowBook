import { findEmployeeByEmail } from "@/features/employees/data/employees-read.repo";
import type { Result } from "@/infra/result";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";
import { replacePendingEmployeeInvitation, type EmployeeInviteResult } from "./employee-invitation-issue";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";
import type { ArchivedEmployeeMatch } from "./employee-profile-results";

// Pasos reutilizables del alta y la edicion de perfil: cada uno recibe solo las
// dependencias que usa. Los casos de uso de perfil los componen.

export interface ArchivedLookupDeps {
  findEmployeeByEmail: typeof findEmployeeByEmail;
}

const defaultArchivedLookupDeps: ArchivedLookupDeps = { findEmployeeByEmail };

/** Paso 'buscar archivado': colaborador inactivo con ese email del salón, si existe. */
export async function findArchivedEmployeeByEmail(
  salonId: string,
  email: string,
  deps: ArchivedLookupDeps = defaultArchivedLookupDeps
): Promise<ArchivedEmployeeMatch | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const employee = await deps.findEmployeeByEmail(trimmed, salonId);
  if (!employee || employee.is_active) return null;

  return {
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`.trim(),
    email: employee.email,
  };
}

export type InviteAccessInput = Parameters<typeof replacePendingEmployeeInvitation>[0];

export interface InviteAccessDeps {
  replacePendingInvitation: typeof replacePendingEmployeeInvitation;
}

const defaultInviteAccessDeps: InviteAccessDeps = {
  replacePendingInvitation: replacePendingEmployeeInvitation,
};

/** Paso 'invitar': sustituye la invitacion pendiente del colaborador por un enlace nuevo. */
export function inviteEmployeeAccess(
  input: InviteAccessInput,
  deps: InviteAccessDeps = defaultInviteAccessDeps
): Promise<Result<EmployeeInviteResult>> {
  return deps.replacePendingInvitation(input);
}

export interface RevokeAccessDeps {
  checkEmployeeAccessRevocable: typeof checkEmployeeAccessRevocable;
  deleteEmployeeAuthAccount: typeof deleteEmployeeAuthAccount;
}

const defaultRevokeAccessDeps: RevokeAccessDeps = {
  checkEmployeeAccessRevocable,
  deleteEmployeeAuthAccount,
};

/** Paso 'revocar acceso' previo a la escritura: valida perfil y owner. No escribe nada. */
export function checkAccessBeforeUnlink(
  profileId: string,
  salonId: string,
  deps: Pick<RevokeAccessDeps, "checkEmployeeAccessRevocable"> = defaultRevokeAccessDeps
): Promise<Result<{ roleId: string | null }>> {
  return deps.checkEmployeeAccessRevocable(profileId, salonId);
}

/**
 * Paso 'revocar acceso' posterior a la escritura: borra la cuenta de Auth del perfil
 * desvinculado. Devuelve los avisos (vacio si todo fue bien) en vez de fallar.
 */
export async function revokeAuthAccountAfterUnlink(
  profileId: string,
  deps: Pick<RevokeAccessDeps, "deleteEmployeeAuthAccount"> = defaultRevokeAccessDeps
): Promise<string[]> {
  const deleted = await deps.deleteEmployeeAuthAccount(profileId);
  return deleted.ok ? [] : [OLD_ACCOUNT_NOT_DELETED_WARNING];
}
