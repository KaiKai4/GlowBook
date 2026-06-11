import { captureError } from "@/lib/observability";
import {
  deleteWorkSchedule,
  upsertWorkSchedule,
} from "@/features/employees/data/employees.repo";
import type { WorkScheduleInput } from "@/features/employees/schemas";
import type { Result } from "@/lib/result";

export async function addEmployeeWorkSchedule(
  salonId: string,
  schedule: WorkScheduleInput
): Promise<Result<void>> {
  if (schedule.end_time <= schedule.start_time) {
    return { ok: false, error: "La hora de fin debe ser mayor que la de inicio." };
  }

  try {
    await upsertWorkSchedule(salonId, schedule);
    return { ok: true, value: undefined };
  } catch (err) {
    captureError(err, { module: "employees", action: "schedule" });
    return { ok: false, error: "Error al guardar el horario (¿ya existe ese bloque?)." };
  }
}

export async function removeEmployeeWorkSchedule(
  salonId: string,
  scheduleId: string
): Promise<Result<void>> {
  try {
    await deleteWorkSchedule(scheduleId, salonId);
    return { ok: true, value: undefined };
  } catch (err) {
    captureError(err, { module: "employees", action: "schedule" });
    return { ok: false, error: "Error al eliminar el horario." };
  }
}
