import { admitNewEmployee, type EmployeeAdmissionInput } from "./employee-admission";
import { parseCreateEmployeeForm, parseUpdateEmployeeForm, readIdempotencyKey } from "./parse-employee-input";
import {
  createEmployeeProfile,
  updateEmployeeProfile,
  type CreateEmployeeResult,
  type EmployeeWriteResult,
} from "./employee-profile";
import type { Result } from "@/infra/result";

export interface CreateEmployeeFlowInput {
  salonId: string;
  /** Roles habilitados en el plan del salón (lo resuelve la accion con el perfil). */
  rolesEnabled: boolean;
  /** Chequeos del plan, inyectados por la accion: el caso de uso no importa billing. */
  checks: EmployeeAdmissionInput["checks"];
}

/**
 * Alta de colaborador. Orden observable: admision del plan (y cupo de login si
 * hay rol) antes de validar la clave de idempotencia y el formulario.
 */
export async function createEmployee(
  input: CreateEmployeeFlowInput,
  formData: FormData
): Promise<Result<CreateEmployeeResult>> {
  const admission = await admitNewEmployee({
    rolesEnabled: input.rolesEnabled,
    requestedRoleId: requestedRoleIdOf(formData),
    checks: input.checks,
  });
  if (!admission.ok) return admission;

  const key = readIdempotencyKey(formData);
  if (!key.ok) return key;
  const parsed = parseCreateEmployeeForm(formData);
  if (!parsed.ok) return parsed;

  return createEmployeeProfile(input.salonId, parsed.value, admission.value.roleId, key.value);
}

/** Edicion de colaborador: clave de idempotencia y formulario, luego la escritura. */
export async function updateEmployee(
  salonId: string,
  employeeId: string,
  formData: FormData
): Promise<Result<EmployeeWriteResult>> {
  const key = readIdempotencyKey(formData);
  if (!key.ok) return key;
  const parsed = parseUpdateEmployeeForm(formData);
  if (!parsed.ok) return parsed;

  return updateEmployeeProfile(employeeId, salonId, parsed.value, key.value);
}

function requestedRoleIdOf(formData: FormData): string | null {
  const raw = formData.get("role_id");
  return typeof raw === "string" ? raw : null;
}
