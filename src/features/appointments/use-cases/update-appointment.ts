import { toPublicErrorMessage } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";
import { captureError } from "@/lib/observability";
import {
  findAppointmentCreationResources,
  findAppointmentForCommand,
  findEmployeeExceptionDatesForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
  updateAppointmentWithRpc,
  type UpdateAppointmentRpcPayload,
} from "../data/appointment-commands.repo";
import { evaluateTimeRange } from "../domain/availability";
import { buildItemPayloads, type SchedulingContext } from "../domain/scheduling";
import type { BusinessHour, OccupiedSlot, ServiceAssignment, WorkSchedule } from "../domain/types";
import type { UpdateAppointmentScheduleInput } from "../schemas";

interface Deps {
  salonId: string;
}

const CLOSED_STATUSES = new Set(["completed", "cancelled", "no_show"]);

export async function updateAppointmentSchedule(
  input: UpdateAppointmentScheduleInput,
  { salonId }: Deps
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;

  try {
    appointment = await findAppointmentForCommand(input.appointment_id, salonId);
  } catch (error) {
    captureError(error, { module: "appointments", action: "update" });
    return err("No se pudo cargar la cita.");
  }

  if (!appointment) return err("Cita no encontrada en este salón.");
  if (CLOSED_STATUSES.has(appointment.status)) {
    return err("Esta cita ya está cerrada y no se puede editar.");
  }
  if (!appointment.customer_id) return err("La cita no tiene un cliente válido.");

  let resources: Awaited<ReturnType<typeof findAppointmentCreationResources>>;

  try {
    resources = await findAppointmentCreationResources({
      salonId,
      customerId: appointment.customer_id,
      assignments: input.assignments,
    });
  } catch (error) {
    captureError(error, { module: "appointments", action: "update" });
    return err("Datos inválidos.");
  }

  if (!resources.customerExists) return err("Cliente no encontrado en este salón.");
  if (!resources.salonConfig) return err("Salón no encontrado.");

  if (resources.assignments.some((assignment) => !assignment.service || !assignment.employee)) {
    return err("Servicio o profesional no encontrado en el salón.");
  }

  const validAssignments = resources.assignments as ServiceAssignment[];
  const startTime = new Date(input.start_time);
  const schedulesCache = new Map<string, WorkSchedule[]>();
  const slotsCache = new Map<string, OccupiedSlot[]>();
  const exceptionsCache = new Map<string, string[]>();

  try {
    for (const { employee } of validAssignments) {
      if (!schedulesCache.has(employee.id)) {
        schedulesCache.set(employee.id, await findEmployeeWorkSchedulesForCommand(employee.id));
      }
      if (!exceptionsCache.has(employee.id)) {
        exceptionsCache.set(employee.id, await findEmployeeExceptionDatesForCommand(employee.id));
      }

      const key = `${employee.id}-${startTime.toDateString()}`;
      if (!slotsCache.has(key)) {
        slotsCache.set(
          key,
          await findEmployeeOccupiedSlotsForCommand({
            employeeId: employee.id,
            date: startTime,
            timezone: resources.salonConfig.timezone,
            excludeAppointmentId: input.appointment_id,
          })
        );
      }
    }
  } catch (error) {
    captureError(error, { module: "appointments", action: "update" });
    return err("No se pudo validar la disponibilidad del profesional.");
  }

  const ctx: SchedulingContext = {
    salonConfig: resources.salonConfig,
    businessHours: resources.businessHours,
    getWorkSchedules: (employeeId) => schedulesCache.get(employeeId) ?? [],
    getOccupiedSlots: (employeeId, date) =>
      slotsCache.get(`${employeeId}-${date.toDateString()}`) ?? [],
    getExceptionDates: (employeeId) => exceptionsCache.get(employeeId) ?? [],
    excludeAppointmentId: input.appointment_id,
  };

  let payloads;
  try {
    payloads = buildItemPayloads(salonId, startTime, validAssignments, ctx);
  } catch (error) {
    return err(toPublicErrorMessage(error, "Error al actualizar la cita. Intenta de nuevo."));
  }

  const lastPayload = payloads[payloads.length - 1];
  if (!lastPayload) throw new Error("Invariante de cita: sin items para calcular el fin.");
  const totalEnd = lastPayload.end_time;
  const globalViolations = evaluateTimeRange({
    start: startTime,
    end: totalEnd,
    salonConfig: resources.salonConfig,
    businessHours: resources.businessHours as BusinessHour[],
    enforceSalonSchedule: true,
    enforceMinDuration: true,
  });

  const [firstGlobalViolation] = globalViolations;
  if (firstGlobalViolation) {
    return err(firstGlobalViolation.message);
  }

  const rpcPayload: UpdateAppointmentRpcPayload = {
    appointment_id: input.appointment_id,
    notes: input.notes ?? "",
    items: payloads.map((payload) => ({
      salon_id: salonId,
      service_id: payload.service_id,
      employee_id: payload.employee_id,
      start_time: payload.start_time.toISOString(),
      end_time: payload.end_time.toISOString(),
      duration_minutes: payload.duration_minutes,
      price: payload.price,
      ordering: payload.ordering,
      blocks_calendar: true,
    })),
  };

  let updated: Awaited<ReturnType<typeof updateAppointmentWithRpc>>;
  try {
    updated = await updateAppointmentWithRpc(rpcPayload);
  } catch (error) {
    captureError(error, { module: "appointments", action: "update" });
    return err("Error al actualizar la cita. Intenta de nuevo.");
  }

  if (!updated.ok) {
    if (updated.errorMessage?.includes("no_overlap_per_employee")) {
      return err("El profesional ya tiene una cita en ese horario. Elige otro horario.");
    }
    return err("Error al actualizar la cita. Intenta de nuevo.");
  }

  return ok(undefined);
}
