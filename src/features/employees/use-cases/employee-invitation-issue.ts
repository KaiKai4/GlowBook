import { generateInvitationToken } from "@/infra/auth/invitation-tokens";
import { findEmployeeById } from "@/features/employees/data/employees.repo";
import {
  deleteEmployeeInvitations,
  deletePendingEmployeeInvitations,
  insertEmployeeInvitation,
} from "@/features/employees/data/employee-invitations.repo";
import { captureError } from "@/infra/observability";
import type { Result } from "@/infra/result";
import { validateAssignableRoleId } from "./employee-role";

/** Caducidad del enlace de invitación de empleado: 7 días. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Emision y limpieza de invitaciones de acceso de colaboradores (no el alta por enlace: ver employee-invitations.ts).

export interface EmployeeInviteResult {
  token: string;
  expiresAt: string;
}

/** Sustituye la invitación pendiente por un enlace nuevo de 7 dias. */
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
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
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

/** Invitación de acceso para un colaborador existente sin cuenta vinculada. */
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

  return replacePendingEmployeeInvitation({
    employeeId,
    salonId,
    email: employee.email.trim(),
    roleId: roleId || null,
  });
}

/** Escritura en BD: elimina las invitaciones del colaborador dentro del salón. */
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
