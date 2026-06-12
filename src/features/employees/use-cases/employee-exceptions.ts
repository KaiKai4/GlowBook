import { captureError } from "@/lib/observability";
import {
  deleteEmployeeException,
  insertEmployeeException,
} from "@/features/employees/data/employee-exceptions.repo";
import type { Result } from "@/lib/result";
import { formatLocalDateISO } from "@/lib/utils/dates";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function addEmployeeScheduleException(input: {
  salonId: string;
  employeeId: string;
  exceptionDate: string;
  reason: string;
  timezone: string;
}): Promise<Result<void>> {
  if (!DATE_PATTERN.test(input.exceptionDate)) {
    return { ok: false, error: "Selecciona una fecha válida." };
  }

  const today = formatLocalDateISO(new Date(), input.timezone);
  if (input.exceptionDate < today) {
    return { ok: false, error: "La fecha del día libre no puede estar en el pasado." };
  }

  try {
    await insertEmployeeException({
      salonId: input.salonId,
      employeeId: input.employeeId,
      exceptionDate: input.exceptionDate,
      reason: input.reason.trim().slice(0, 200),
    });
    return { ok: true, value: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("schedule_exceptions_unique")) {
      return { ok: false, error: "Ese día ya está registrado como libre." };
    }
    captureError(error, { module: "employees", action: "exception-add" });
    return { ok: false, error: "No se pudo guardar el día libre." };
  }
}

export async function removeEmployeeScheduleException(
  salonId: string,
  employeeId: string,
  exceptionId: string
): Promise<Result<void>> {
  try {
    await deleteEmployeeException(exceptionId, employeeId, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "employees", action: "exception-remove" });
    return { ok: false, error: "No se pudo eliminar el día libre." };
  }
}
