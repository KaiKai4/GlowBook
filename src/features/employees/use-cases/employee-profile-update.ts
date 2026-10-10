import { findEmployeeById } from "@/features/employees/data/employees-read.repo";
import { updateEmployeeProfileRecord } from "@/features/employees/data/employees-write.repo";
import { findLatestPendingEmployeeInvitationRole } from "@/features/employees/data/employee-invitations.repo";
import type { UpdateEmployeeProfileRpcFields } from "@/features/employees/data/rpc/update-employee-rpc";
import type { UpdateEmployeeInput } from "@/features/employees/schemas";
import { captureError } from "@/infra/observability";
import { toPublicErrorMessage } from "@/infra/errors";
import { ok, type Result } from "@/infra/result";
import { validateEmployeeAssignments } from "./employee-assignments";
import { replacePendingEmployeeInvitation, type EmployeeAccessLookup } from "./employee-invitation-issue";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";
import {
  checkAccessBeforeUnlink,
  inviteEmployeeAccess,
  revokeAuthAccountAfterUnlink,
  type InviteAccessDeps,
  type RevokeAccessDeps,
} from "./employee-profile-steps";
import type { EmployeeWriteResult } from "./employee-profile-results";

/** Dependencias de la edicion de perfil. Producción usa las funciones reales; los tests inyectan fakes. */
export interface UpdateEmployeeProfileDeps extends RevokeAccessDeps, InviteAccessDeps {
  findEmployeeById: (id: string, salonId: string) => Promise<EmployeeAccessLookup | null>;
  validateAssignments: typeof validateEmployeeAssignments;
  findLatestPendingInvitationRole: typeof findLatestPendingEmployeeInvitationRole;
  updateProfileRecord: typeof updateEmployeeProfileRecord;
}

const defaultUpdateEmployeeProfileDeps: UpdateEmployeeProfileDeps = {
  findEmployeeById,
  validateAssignments: validateEmployeeAssignments,
  findLatestPendingInvitationRole: findLatestPendingEmployeeInvitationRole,
  updateProfileRecord: updateEmployeeProfileRecord,
  checkEmployeeAccessRevocable,
  deleteEmployeeAuthAccount,
  replacePendingInvitation: replacePendingEmployeeInvitation,
};

/** Solo los campos de perfil presentes en la entrada: una clave ausente no se escribe. */
function presentProfileFields(input: UpdateEmployeeInput, nextEmail: string): UpdateEmployeeProfileRpcFields {
  const fields: UpdateEmployeeProfileRpcFields = {};
  if (input.first_name !== undefined) fields.first_name = input.first_name.trim();
  if (input.last_name !== undefined) fields.last_name = input.last_name.trim();
  if (input.phone !== undefined) fields.phone = input.phone;
  if (input.email !== undefined) fields.email = nextEmail;
  if (input.specialty !== undefined) fields.specialty = input.specialty;
  if (input.commission_percentage !== undefined) fields.commission_percentage = input.commission_percentage;
  return fields;
}

/**
 * Edicion de perfil: lectura previa, validaciones, desvinculacion y reinvitacion si
 * cambia el email, una sola escritura RPC y, despues, los efectos posteriores (borrar
 * la cuenta anterior y emitir el enlace), que si fallan se avisan en vez de fallar.
 */
export async function updateEmployeeProfile(
  employeeId: string,
  salonId: string,
  input: UpdateEmployeeInput,
  idempotencyKey: string,
  deps: UpdateEmployeeProfileDeps = defaultUpdateEmployeeProfileDeps
): Promise<Result<EmployeeWriteResult>> {
  try {
    // Lectura previa a cualquier escritura: estado actual, invitación pendiente y validaciones.
    const currentEmployee = await deps.findEmployeeById(employeeId, salonId);
    if (!currentEmployee) return { ok: false, error: "Colaborador no encontrado." };

    const { service_ids, category_ids } = input;
    await deps.validateAssignments(salonId, service_ids ?? [], category_ids ?? []);

    const currentEmail = currentEmployee.email?.trim() ?? "";
    const nextEmail = typeof input.email === "string" ? input.email.trim() : currentEmail;
    const emailChanged = nextEmail.toLowerCase() !== currentEmail.toLowerCase();
    let inviteRoleId: string | null = null;
    let unlinkProfile = false;
    let revokedProfileId: string | null = null;

    if (emailChanged && currentEmployee.profile_id) {
      if (!nextEmail) {
        return {
          ok: false,
          error: "No puedes dejar sin email a un colaborador que ya tiene acceso al sistema.",
        };
      }

      // Validacion previa (owner, perfil existente): no escribe nada.
      const access = await checkAccessBeforeUnlink(currentEmployee.profile_id, salonId, {
        checkEmployeeAccessRevocable: deps.checkEmployeeAccessRevocable,
      });
      if (!access.ok) return { ok: false, error: access.error };
      inviteRoleId = access.value.roleId;
      unlinkProfile = true;
      revokedProfileId = currentEmployee.profile_id;
    } else if (emailChanged && !currentEmployee.profile_id && nextEmail) {
      // La invitación pendiente se lee ANTES de escribir: la RPC la invalida al cambiar el email.
      const { data: latestInvite, error: latestInviteError } =
        await deps.findLatestPendingInvitationRole(employeeId, salonId);

      if (latestInviteError) {
        captureError(latestInviteError, { module: "employees", action: "profile" });
        return { ok: false, error: "No se pudo verificar la invitación pendiente." };
      }
      inviteRoleId = latestInvite?.role_id ?? null;
    }

    await deps.updateProfileRecord(employeeId, {
      fields: presentProfileFields(input, nextEmail),
      serviceIds: service_ids,
      categoryIds: category_ids,
      unlinkProfile,
      idempotencyKey,
    });

    // Efectos posteriores a la escritura confirmada: si fallan, se avisa en vez de fallar.
    const warnings: string[] = [];
    if (revokedProfileId) {
      warnings.push(
        ...(await revokeAuthAccountAfterUnlink(revokedProfileId, {
          deleteEmployeeAuthAccount: deps.deleteEmployeeAuthAccount,
        }))
      );
    }

    if (emailChanged && nextEmail) {
      const invite = await inviteEmployeeAccess(
        { employeeId, salonId, email: nextEmail, roleId: inviteRoleId },
        { replacePendingInvitation: deps.replacePendingInvitation }
      );
      if (!invite.ok) warnings.push(invite.error);
    }

    return ok({}, warnings);
  } catch (err) {
    return {
      ok: false,
      error: toPublicErrorMessage(err, "Error al actualizar el colaborador."),
    };
  }
}
