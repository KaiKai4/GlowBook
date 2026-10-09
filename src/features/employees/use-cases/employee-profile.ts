import { captureError } from "@/infra/observability";
import { toPublicErrorMessage } from "@/infra/errors";
import {
  createEmployee as insertEmployee,
  findEmployeeById,
  findEmployeeByEmail,
  updateEmployeeProfileRecord,
} from "@/features/employees/data/employees.repo";
import { validateEmployeeAssignments } from "@/features/employees/use-cases/employee-assignments";
import {
  generateEmployeeInvitation,
  replacePendingEmployeeInvitation,
  revokeEmployeeAuthAccess,
} from "./employee-access";
import { findLatestPendingEmployeeInvitationRole } from "@/features/employees/data/employee-access.repo";
import type { UpdateEmployeeProfileRpcFields } from "@/features/employees/data/rpc/update-employee-rpc";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/features/employees/schemas";
import type { Result } from "@/infra/result";

export interface CreateEmployeeResult {
  id: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
  /** La escritura se confirmo, pero un efecto posterior (p. ej. el enlace de acceso) fallo. */
  warnings?: string[];
}

export interface EmployeeWriteResult {
  /** La escritura se confirmo, pero un efecto posterior fallo. */
  warnings?: string[];
}

export interface ArchivedEmployeeMatch {
  id: string;
  name: string;
  email: string;
}

export async function findArchivedEmployeeByEmail(
  salonId: string,
  email: string
): Promise<ArchivedEmployeeMatch | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const employee = await findEmployeeByEmail(trimmed, salonId);
  if (!employee || employee.is_active) return null;

  return {
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`.trim(),
    email: employee.email,
  };
}

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

export async function createEmployeeProfile(
  salonId: string,
  input: CreateEmployeeInput,
  roleId: string | null,
  idempotencyKey: string
): Promise<Result<CreateEmployeeResult>> {
  try {
    const { service_ids, category_ids, ...employee } = input;
    const email = employee.email.trim();
    if (email) {
      // Un colaborador archivado con ese email se restaura en vez de duplicarse. Un activo lo
      // rechaza la RPC (validacion transaccional), y asi un reintento idempotente sigue devolviendo el resultado guardado.
      const archived = await findArchivedEmployeeByEmail(salonId, email);
      if (archived) {
        return {
          ok: false,
          error: "Ya existe un colaborador con ese email. Restauralo para conservar su historial.",
        };
      }
    }

    await validateEmployeeAssignments(salonId, service_ids, category_ids);
    const created = await insertEmployee(
      {
        first_name: employee.first_name.trim(),
        last_name: employee.last_name.trim(),
        phone: employee.phone,
        email,
        specialty: employee.specialty,
        commission_percentage: employee.commission_percentage,
        hire_date: employee.hire_date ?? null,
      },
      service_ids,
      category_ids,
      idempotencyKey
    );

    if (email && roleId) {
      const invite = await generateEmployeeInvitation({
        employeeId: created.id,
        salonId,
        email,
        roleId,
      });

      if (invite.ok) {
        return {
          ok: true,
          value: {
            id: created.id,
            inviteToken: invite.value.token,
            inviteExpiresAt: invite.value.expiresAt,
          },
        };
      }

      return { ok: true, value: { id: created.id, warnings: [invite.error] } };
    }

    return { ok: true, value: { id: created.id } };
  } catch (err) {
    return {
      ok: false,
      error: toPublicErrorMessage(err, "Error al crear el colaborador."),
    };
  }
}

export async function updateEmployeeProfile(
  employeeId: string,
  salonId: string,
  input: UpdateEmployeeInput,
  idempotencyKey: string
): Promise<Result<EmployeeWriteResult>> {
  try {
    // Lectura previa a cualquier escritura: estado actual, invitacion pendiente y validaciones.
    const currentEmployee = await findEmployeeById(employeeId, salonId);
    if (!currentEmployee) return { ok: false, error: "Colaborador no encontrado." };

    const { service_ids, category_ids } = input;
    await validateEmployeeAssignments(salonId, service_ids ?? [], category_ids ?? []);

    const currentEmail = currentEmployee.email?.trim() ?? "";
    const nextEmail = typeof input.email === "string" ? input.email.trim() : currentEmail;
    const emailChanged = nextEmail.toLowerCase() !== currentEmail.toLowerCase();
    let inviteRoleId: string | null = null;
    let unlinkProfile = false;

    if (emailChanged && currentEmployee.profile_id) {
      if (!nextEmail) {
        return {
          ok: false,
          error: "No puedes dejar sin email a un colaborador que ya tiene acceso al sistema.",
        };
      }

      const revoked = await revokeEmployeeAuthAccess(employeeId, salonId, currentEmployee.profile_id);
      if (!revoked.ok) return { ok: false, error: revoked.error };
      inviteRoleId = revoked.value.roleId;
      unlinkProfile = true;
    } else if (emailChanged && !currentEmployee.profile_id && nextEmail) {
      // La invitacion pendiente se lee ANTES de escribir: la RPC la invalida al cambiar el email.
      const { data: latestInvite, error: latestInviteError } =
        await findLatestPendingEmployeeInvitationRole(employeeId, salonId);

      if (latestInviteError) {
        captureError(latestInviteError, { module: "employees", action: "profile" });
        return { ok: false, error: "No se pudo verificar la invitacion pendiente." };
      }
      inviteRoleId = latestInvite?.role_id ?? null;
    }

    await updateEmployeeProfileRecord(employeeId, {
      fields: presentProfileFields(input, nextEmail),
      serviceIds: service_ids,
      categoryIds: category_ids,
      unlinkProfile,
      idempotencyKey,
    });

    if (emailChanged && nextEmail) {
      const invite = await replacePendingEmployeeInvitation({
        employeeId,
        salonId,
        email: nextEmail,
        roleId: inviteRoleId,
      });
      if (!invite.ok) return { ok: true, value: { warnings: [invite.error] } };
    }

    return { ok: true, value: {} };
  } catch (err) {
    return {
      ok: false,
      error: toPublicErrorMessage(err, "Error al actualizar el colaborador."),
    };
  }
}
