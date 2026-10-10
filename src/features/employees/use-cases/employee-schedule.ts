import { captureError } from "@/infra/observability";
import {
  deleteWorkSchedule,
  upsertWorkSchedule,
} from "@/features/employees/data/work-schedules.repo";
import type { WorkScheduleInput } from "@/features/employees/schemas";
import type { Result } from "@/infra/result";

/** Dependencias de los horarios semanales. Producción usa las funciones reales; los tests inyectan fakes. */
export interface EmployeeScheduleDeps {
  upsertSchedule: typeof upsertWorkSchedule;
  deleteSchedule: typeof deleteWorkSchedule;
}

const defaultEmployeeScheduleDeps: EmployeeScheduleDeps = {
  upsertSchedule: upsertWorkSchedule,
  deleteSchedule: deleteWorkSchedule,
};

export async function addEmployeeWorkSchedule(
  salonId: string,
  schedule: WorkScheduleInput,
  deps: EmployeeScheduleDeps = defaultEmployeeScheduleDeps
): Promise<Result<void>> {
  if (schedule.end_time <= schedule.start_time) {
    return { ok: false, error: "La hora de fin debe ser mayor que la de inicio." };
  }

  try {
    await deps.upsertSchedule(salonId, schedule);
    return { ok: true, value: undefined };
  } catch (err) {
    captureError(err, { module: "employees", action: "schedule" });
    return { ok: false, error: "Error al guardar el horario (¿ya existe ese bloque?)." };
  }
}

export async function removeEmployeeWorkSchedule(
  salonId: string,
  scheduleId: string,
  deps: EmployeeScheduleDeps = defaultEmployeeScheduleDeps
): Promise<Result<void>> {
  try {
    await deps.deleteSchedule(scheduleId, salonId);
    return { ok: true, value: undefined };
  } catch (err) {
    captureError(err, { module: "employees", action: "schedule" });
    return { ok: false, error: "Error al eliminar el horario." };
  }
}
