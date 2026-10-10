import { addEmployeeScheduleException } from "./employee-exceptions";
import { reactivateEmployee } from "./employee-lifecycle";
import { getSalonSchedulingConfig } from "@/features/salon";
import { err, type Result } from "@/infra/result";

/** Reactivar consume el cupo de colaboradores activos del plan (chequeo inyectado). */
export async function reactivateEmployeeFlow(
  input: { salonId: string; checkActiveLimit: () => Promise<Result<void>> },
  employeeId: string
): Promise<Result<void>> {
  const limit = await input.checkActiveLimit();
  if (!limit.ok) return err(limit.error);

  return reactivateEmployee(employeeId, input.salonId);
}

/** Excepcion de agenda: la zona horaria del salon se lee aqui, no en la accion. */
export async function addScheduleExceptionFlow(
  input: { salonId: string },
  data: { employeeId: string; exceptionDate: string; reason: string }
): Promise<Result<void>> {
  const { salonConfig } = await getSalonSchedulingConfig(input.salonId);

  return addEmployeeScheduleException({
    salonId: input.salonId,
    employeeId: data.employeeId,
    exceptionDate: data.exceptionDate,
    reason: data.reason,
    timezone: salonConfig.timezone,
  });
}
