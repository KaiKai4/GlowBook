import { createEmployee } from "@/features/employees/data/employees-write.repo";
import { findEmployeeByEmail } from "@/features/employees/data/employees-read.repo";
import { toPublicErrorMessage } from "@/infra/errors";
import type { Result } from "@/infra/result";
import type { CreateEmployeeInput } from "@/features/employees/schemas";
import { validateEmployeeAssignments } from "./employee-assignments";
import { replacePendingEmployeeInvitation } from "./employee-invitation-issue";
import { findArchivedEmployeeByEmail, inviteEmployeeAccess, type ArchivedLookupDeps, type InviteAccessDeps } from "./employee-profile-steps";
import type { CreateEmployeeResult } from "./employee-profile-results";

/** Dependencias del alta de perfil. Producción usa las funciones reales; los tests inyectan fakes. */
export interface CreateEmployeeProfileDeps extends ArchivedLookupDeps, InviteAccessDeps {
  validateAssignments: typeof validateEmployeeAssignments;
  insertEmployee: typeof createEmployee;
}

const defaultCreateEmployeeProfileDeps: CreateEmployeeProfileDeps = {
  findEmployeeByEmail,
  replacePendingInvitation: replacePendingEmployeeInvitation,
  validateAssignments: validateEmployeeAssignments,
  insertEmployee: createEmployee,
};

/**
 * Alta de perfil: rechaza un email archivado (se restaura, no se duplica), valida
 * asignaciones, escribe en una RPC transaccional y emite el enlace de acceso si hay rol.
 * Si el enlace falla tras confirmarse el alta, devuelve el alta con aviso.
 */
export async function createEmployeeProfile(
  salonId: string,
  input: CreateEmployeeInput,
  roleId: string | null,
  idempotencyKey: string,
  deps: CreateEmployeeProfileDeps = defaultCreateEmployeeProfileDeps
): Promise<Result<CreateEmployeeResult>> {
  try {
    const { service_ids, category_ids, ...employee } = input;
    const email = employee.email.trim();
    if (email) {
      // Un colaborador archivado con ese email se restaura en vez de duplicarse. Un activo lo
      // rechaza la RPC (validacion transaccional), y asi un reintento idempotente sigue devolviendo el resultado guardado.
      const archived = await findArchivedEmployeeByEmail(salonId, email, { findEmployeeByEmail: deps.findEmployeeByEmail });
      if (archived) {
        return {
          ok: false,
          error: "Ya existe un colaborador con ese email. Restauralo para conservar su historial.",
        };
      }
    }

    await deps.validateAssignments(salonId, service_ids, category_ids);
    const created = await deps.insertEmployee(
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
      const invite = await inviteEmployeeAccess(
        { employeeId: created.id, salonId, email, roleId },
        { replacePendingInvitation: deps.replacePendingInvitation }
      );

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
