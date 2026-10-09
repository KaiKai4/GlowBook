"use server";

import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { WorkScheduleSchema, type WorkScheduleInput } from "@/features/employees/schemas";
import {
  archiveEmployee,
} from "@/features/employees/use-cases/employee-lifecycle";
import {
  addEmployeeWorkSchedule,
  removeEmployeeWorkSchedule,
} from "@/features/employees/use-cases/employee-schedule";
import { removeEmployeeScheduleException } from "@/features/employees/use-cases/employee-exceptions";
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
import {
  changeEmployeeRoleFlow,
  generateEmployeeInviteFlow,
  resetEmployeeAccessFlow,
  type RoleGate,
} from "@/features/employees/use-cases/employee-role-flows";
import {
  addScheduleExceptionFlow,
  reactivateEmployeeFlow,
} from "@/features/employees/use-cases/employee-lifecycle-flows";
import { err, ok, type Result } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";
import type { ProfileWithRole } from "@/types/app.types";
import {
  activeLimitCheck,
  admissionChecks,
  EMPLOYEE_GUARD,
  loginLimitCheck,
  rolesEnabledOf,
} from "./employee-action-guard";

// Cada accion es una especificacion de defineAction (permiso, limite, validacion,
// un caso de uso y revalidacion). La exportacion publica solo adapta la firma.

const INVALID_ID = "Identificador inválido.";

/** Identificadores de la accion: un null (rol opcional) es valido, un UUID mal formado no. */
function checkIds<T>(value: T, ids: (string | null)[]): Result<T> {
  return ids.every((id) => id === null || parseUuid(id) !== null) ? ok(value) : err(INVALID_ID);
}

async function roleGateOf(session: { salonId: string; profile: ProfileWithRole }): Promise<RoleGate> {
  return { salonId: session.salonId, rolesEnabled: await rolesEnabledOf(session.profile) };
}

type EmployeeInvite = { token: string; expiresAt: string };
type EmployeeRoleRaw = { employeeId: string; roleId: string | null };
type RoleChangeRaw = { profileId: string; roleId: string | null };
type UpdateEmployeeRaw = { employeeId: string; formData: FormData };
type ScheduleDeleteRaw = { scheduleId: string; employeeId: string };
type ExceptionAddRaw = { employeeId: string; exceptionDate: string; reason: string };
type ExceptionRemoveRaw = { employeeId: string; exceptionId: string };

const createEmployeeFlowAction = defineAction<FormData, FormData, CreateEmployeeResult>({
  ...EMPLOYEE_GUARD,
  parse: (formData) => ok(formData),
  run: async (formData, session) =>
    createEmployeeFlow(
      {
        salonId: session.salonId,
        rolesEnabled: await rolesEnabledOf(session.profile),
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

const changeRoleFlowAction = defineAction<RoleChangeRaw, RoleChangeRaw, void>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.profileId, raw.roleId]),
  run: async (raw, session) => changeEmployeeRoleFlow(await roleGateOf(session), raw),
  revalidate: () => ["/employees"],
});

const resetAccessFlowAction = defineAction<EmployeeRoleRaw, EmployeeRoleRaw, EmployeeInvite>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.employeeId, raw.roleId]),
  run: async (raw, session) => resetEmployeeAccessFlow(await roleGateOf(session), raw),
  revalidate: (_out, raw) => ["/employees", `/employees/${raw.employeeId}`],
});

const addWorkScheduleFlowAction = defineAction<FormData, WorkScheduleInput, void>({
  ...EMPLOYEE_GUARD,
  parse: (formData) =>
    parseWithSchema(WorkScheduleSchema)({
      employee_id: formData.get("employee_id"),
      day_of_week: Number(formData.get("day_of_week")),
      start_time: formData.get("start_time"),
      end_time: formData.get("end_time"),
    }),
  run: (input, session) => addEmployeeWorkSchedule(session.salonId, input),
  revalidate: (_out, input) => [`/employees/${input.employee_id}`],
});

const deleteWorkScheduleFlowAction = defineAction<ScheduleDeleteRaw, ScheduleDeleteRaw, void>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.scheduleId, raw.employeeId]),
  run: (raw, session) => removeEmployeeWorkSchedule(session.salonId, raw.scheduleId),
  revalidate: (_out, raw) => [`/employees/${raw.employeeId}`],
});

const generateInviteFlowAction = defineAction<EmployeeRoleRaw, EmployeeRoleRaw, EmployeeInvite>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.employeeId, raw.roleId]),
  run: async (raw, session) =>
    generateEmployeeInviteFlow(
      { ...(await roleGateOf(session)), checkLoginLimit: loginLimitCheck(session.salonId) },
      raw
    ),
  revalidate: (_out, raw) => [`/employees/${raw.employeeId}`],
});

const archiveFlowAction = defineAction<string, string, { outcome: "deleted" | "archived"; message: string }>({
  ...EMPLOYEE_GUARD,
  parse: (employeeId) => checkIds(employeeId, [employeeId]),
  run: (employeeId, session) => archiveEmployee(employeeId, session.salonId),
  revalidate: (_out, employeeId) => ["/employees", `/employees/${employeeId}`, "/appointments/new"],
});

const addExceptionFlowAction = defineAction<ExceptionAddRaw, ExceptionAddRaw, void>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.employeeId]),
  run: (raw, session) => addScheduleExceptionFlow({ salonId: session.salonId }, raw),
  revalidate: (_out, raw) => [`/employees/${raw.employeeId}`, "/appointments"],
});

const removeExceptionFlowAction = defineAction<ExceptionRemoveRaw, ExceptionRemoveRaw, void>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.employeeId, raw.exceptionId]),
  run: (raw, session) => removeEmployeeScheduleException(session.salonId, raw.employeeId, raw.exceptionId),
  revalidate: (_out, raw) => [`/employees/${raw.employeeId}`, "/appointments"],
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

export async function changeEmployeeRoleAction(profileId: string, roleId: string | null): Promise<Result<void>> {
  return changeRoleFlowAction({ profileId, roleId });
}

export async function resetEmployeeAccessAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<EmployeeInvite>> {
  return resetAccessFlowAction({ employeeId, roleId });
}

export async function addWorkScheduleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return addWorkScheduleFlowAction(formData);
}

export async function deleteWorkScheduleAction(scheduleId: string, employeeId: string): Promise<Result<void>> {
  return deleteWorkScheduleFlowAction({ scheduleId, employeeId });
}

export async function generateEmployeeInviteAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<EmployeeInvite>> {
  return generateInviteFlowAction({ employeeId, roleId });
}

export async function deleteEmployeeAction(
  employeeId: string
): Promise<Result<{ outcome: "deleted" | "archived"; message: string }>> {
  return archiveFlowAction(employeeId);
}

export async function addScheduleExceptionAction(
  employeeId: string,
  exceptionDate: string,
  reason: string
): Promise<Result<void>> {
  return addExceptionFlowAction({ employeeId, exceptionDate, reason });
}

export async function removeScheduleExceptionAction(employeeId: string, exceptionId: string): Promise<Result<void>> {
  return removeExceptionFlowAction({ employeeId, exceptionId });
}
