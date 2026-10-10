"use server";

import { defineAction } from "@/app/_composition/define-action";
import { archiveEmployee } from "@/features/employees/use-cases/employee-lifecycle";
import {
  findArchivedEmployeeByEmail,
  type ArchivedEmployeeMatch,
  type CreateEmployeeResult,
  type EmployeeWriteResult,
} from "@/features/employees/use-cases/employee-profile";
import {
  createEmployeeFlow,
  updateEmployeeFlow,
} from "@/features/employees/use-cases/employee-profile-flow";
import { reactivateEmployeeFlow } from "@/features/employees/use-cases/employee-lifecycle-flows";
import { ok, type Result } from "@/infra/result";
import {
  activeLimitCheck,
  admissionChecks,
  checkIds,
  EMPLOYEE_GUARD,
} from "./employee-action-guard";

// Acciones de ficha del colaborador: alta, busqueda de archivados, edicion, reactivacion y baja.
// Cada accion es una especificacion de defineAction (permiso, limite, validacion,
// un caso de uso y revalidacion). La exportacion publica solo adapta la firma.

type UpdateEmployeeRaw = { employeeId: string; formData: FormData };

const createEmployeeFlowAction = defineAction<FormData, FormData, CreateEmployeeResult>({
  ...EMPLOYEE_GUARD,
  parse: (formData) => ok(formData),
  run: async (formData, session) =>
    createEmployeeFlow(
      {
        salonId: session.salonId,
        rolesEnabled: session.rolesEnabled,
        checks: admissionChecks(session.salonId),
      },
      formData
    ),
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
    reactivateEmployeeFlow(
      { salonId: session.salonId, checkActiveLimit: activeLimitCheck(session.salonId) },
      employeeId
    ),
  revalidate: (_out, employeeId) => ["/employees", `/employees/${employeeId}`, "/appointments/new"],
});

const updateEmployeeFlowAction = defineAction<UpdateEmployeeRaw, UpdateEmployeeRaw, EmployeeWriteResult>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.employeeId]),
  run: (raw, session) => updateEmployeeFlow(session.salonId, raw.employeeId, raw.formData),
  revalidate: (_out, raw) => ["/employees", `/employees/${raw.employeeId}`],
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
