import { admitNewEmployee, type EmployeeAdmissionInput } from "./employee-admission";
import { createEmployeeProfile } from "./employee-profile-create";
import { updateEmployeeProfile } from "./employee-profile-update";
import type { CreateEmployeeResult, EmployeeWriteResult } from "./employee-profile-results";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "../schemas";
import type { Result } from "@/infra/result";

export interface CreateEmployeeFlowInput {
  salonId: string;
  /** Roles habilitados en el plan del salón (lo resuelve la accion con el perfil). */
  rolesEnabled: boolean;
  /** Chequeos del plan, inyectados por la accion: el caso de uso no importa billing. */
  checks: EmployeeAdmissionInput["checks"];
  /** Rol pedido en el formulario (null si no se envio). */
  requestedRoleId: string | null;
  idempotencyKey: string;
  /** Datos del alta, ya validados en el borde (la accion). */
  data: CreateEmployeeInput;
}

/** Alta de colaborador: admision del plan (y cupo de login si hay rol) y luego la escritura. */
export async function createEmployee(input: CreateEmployeeFlowInput): Promise<Result<CreateEmployeeResult>> {
  const admission = await admitNewEmployee({
    rolesEnabled: input.rolesEnabled,
    requestedRoleId: input.requestedRoleId,
    checks: input.checks,
  });
  if (!admission.ok) return admission;

  return createEmployeeProfile(input.salonId, input.data, admission.value.roleId, input.idempotencyKey);
}

/** Edicion de colaborador: la escritura de los campos presentes. */
export async function updateEmployee(
  salonId: string,
  employeeId: string,
  data: UpdateEmployeeInput,
  idempotencyKey: string
): Promise<Result<EmployeeWriteResult>> {
  return updateEmployeeProfile(employeeId, salonId, data, idempotencyKey);
}
