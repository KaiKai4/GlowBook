"use server";

import { defineAction } from "@/app/_composition/define-action";
import { archiveEmployee } from "@/features/employees";
import {
  findArchivedEmployeeByEmail,
  type ArchivedEmployeeMatch,
  type CreateEmployeeResult,
  type EmployeeWriteResult,
} from "@/features/employees";
import {
  createEmployee,
  updateEmployee,
} from "@/features/employees";
import { reactivateEmployeeWithLimitCheck } from "@/features/employees";
import { ok, type Result } from "@/infra/result";
import {
  activeLimitCheck,
  admissionChecks,
  checkIds,
  EMPLOYEE_GUARD,
} from "./employee-action-guard";
import {
  parseCreateEmployeeForm,
  parseUpdateEmployeeForm,
  type CreateEmployeeForm,
  type UpdateEmployeeForm,
  type UpdateEmployeeRaw,
} from "./employee-form-input";

// Acciones de ficha del colaborador: alta, busqueda de archivados, edicion, reactivacion y baja.
// Cada accion es una especificacion de defineAction (permiso, limite, validacion,
// un caso de uso y revalidacion). La exportacion publica solo adapta la firma.
//
// Orden del alta (cambio intencionado, fase 5): el formulario (clave de
// idempotencia y campos) se valida en el borde, antes del caso de uso. Un
// formulario invalido responde con su error sin consultar el plan. La admision
// del plan (y el cupo de login) ocurre dentro del caso de uso, despues de validar.

const createEmployeeFlowAction = defineAction<FormData, CreateEmployeeForm, CreateEmployeeResult>({
  ...EMPLOYEE_GUARD,
  parse: parseCreateEmployeeForm,
  run: async (form, session) =>
    createEmployee({
      salonId: session.salonId,
      rolesEnabled: session.rolesEnabled,
      checks: admissionChecks(session.salonId),
      requestedRoleId: form.requestedRoleId,
      idempotencyKey: form.idempotencyKey,
      data: form.data,
    }),
  revalidate: () => ["/employees"],
});

const findArchivedFlowAction = defineAction<string, string, ArchivedEmployeeMatch | null>({
  ...EMPLOYEE_GUARD,
  parse: (email) => ok(email),
  run: async (email, session) => ok(await findArchivedEmployeeByEmail(session.salonId, email)),
});

const reactivateFlowAction = defineAction<string, string, void>({
  ...EMPLOYEE_GUARD,
  parse: (employeeId) => checkIds(employeeId, [employeeId]),
  run: (employeeId, session) =>
    reactivateEmployeeWithLimitCheck(
      { salonId: session.salonId, checkActiveLimit: activeLimitCheck(session.salonId) },
      employeeId
    ),
  revalidate: (_out, employeeId) => ["/employees", `/employees/${employeeId}`, "/appointments/new"],
});

const updateEmployeeFlowAction = defineAction<UpdateEmployeeRaw, UpdateEmployeeForm, EmployeeWriteResult>({
  ...EMPLOYEE_GUARD,
  parse: parseUpdateEmployeeForm,
  run: (form, session) =>
    updateEmployee(session.salonId, form.employeeId, form.data, form.idempotencyKey),
  revalidate: (_out, form) => ["/employees", `/employees/${form.employeeId}`],
});

const archiveFlowAction = defineAction<string, string, { outcome: "deleted" | "archived"; message: string }>({
  ...EMPLOYEE_GUARD,
  parse: (employeeId) => checkIds(employeeId, [employeeId]),
  run: (employeeId, session) => archiveEmployee(employeeId, session.salonId),
  revalidate: (_out, employeeId) => ["/employees", `/employees/${employeeId}`, "/appointments/new"],
});

export async function createEmployeeAction(
  _prev: Result<CreateEmployeeResult> | null,
  formData: FormData
): Promise<Result<CreateEmployeeResult>> {
  return createEmployeeFlowAction(formData);
}

export async function findArchivedEmployeeByEmailAction(email: string): Promise<ArchivedEmployeeMatch | null> {
  const result = await findArchivedFlowAction(email);
  return result.ok ? result.value : null;
}

export async function reactivateEmployeeAction(employeeId: string): Promise<Result<void>> {
  return reactivateFlowAction(employeeId);
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: Result<EmployeeWriteResult> | null,
  formData: FormData
): Promise<Result<EmployeeWriteResult>> {
  return updateEmployeeFlowAction({ employeeId, formData });
}

export async function deleteEmployeeAction(
  employeeId: string
): Promise<Result<{ outcome: "deleted" | "archived"; message: string }>> {
  return archiveFlowAction(employeeId);
}
