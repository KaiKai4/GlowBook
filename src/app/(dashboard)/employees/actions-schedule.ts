"use server";

import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { WorkScheduleSchema, type WorkScheduleInput } from "@/features/employees/schemas";
import {
  addEmployeeWorkSchedule,
  removeEmployeeWorkSchedule,
} from "@/features/employees/use-cases/employee-schedule";
import { removeEmployeeScheduleException } from "@/features/employees/use-cases/employee-exceptions";
import { addScheduleExceptionFlow } from "@/features/employees/use-cases/employee-lifecycle-flows";
import type { Result } from "@/infra/result";
import { checkIds, EMPLOYEE_GUARD } from "./employee-action-guard";

// Acciones de horario: jornadas semanales y excepciones de calendario del colaborador.

type ScheduleDeleteRaw = { scheduleId: string; employeeId: string };
type ExceptionAddRaw = { employeeId: string; exceptionDate: string; reason: string };
type ExceptionRemoveRaw = { employeeId: string; exceptionId: string };

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

export async function addWorkScheduleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return addWorkScheduleFlowAction(formData);
}

export async function deleteWorkScheduleAction(scheduleId: string, employeeId: string): Promise<Result<void>> {
  return deleteWorkScheduleFlowAction({ scheduleId, employeeId });
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
