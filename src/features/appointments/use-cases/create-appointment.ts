import { err, ok, type Result } from "@/lib/result";
import { captureError } from "@/lib/observability";
import {
  createAppointmentWithRpc,
  findAppointmentCreationResources,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
  type CreateAppointmentRpcPayload,
} from "../data/appointment-commands.repo";
import { evaluateTimeRange } from "../domain/availability";
import { buildItemPayloads } from "../domain/scheduling";
import type { SchedulingContext } from "../domain/scheduling";
import type { BusinessHour, OccupiedSlot, ServiceAssignment, WorkSchedule } from "../domain/types";
import type { CreateAppointmentInput } from "../schemas";

interface Deps {
  salonId: string;
  userId: string;
}

export async function createAppointment(
  input: CreateAppointmentInput,
  { salonId, userId }: Deps
): Promise<Result<string>> {
  let resources: Awaited<ReturnType<typeof findAppointmentCreationResources>>;

  try {
    resources = await findAppointmentCreationResources({
      salonId,
      customerId: input.customer_id,
      assignments: input.assignments,
    });
  } catch (error) {
    captureError(error, { module: "appointments", action: "create" });
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

  try {
    for (const { employee } of validAssignments) {
      if (!schedulesCache.has(employee.id)) {
        schedulesCache.set(employee.id, await findEmployeeWorkSchedulesForCommand(employee.id));
      }

      const key = `${employee.id}-${startTime.toDateString()}`;
      if (!slotsCache.has(key)) {
        slotsCache.set(
          key,
          await findEmployeeOccupiedSlotsForCommand({
            employeeId: employee.id,
            date: startTime,
            timezone: resources.salonConfig.timezone,
          })
        );
      }
    }
  } catch (error) {
    captureError(error, { module: "appointments", action: "create" });
    return err("No se pudo validar la disponibilidad del profesional.");
  }

  const ctx: SchedulingContext = {
    salonConfig: resources.salonConfig,
    businessHours: resources.businessHours,
    getWorkSchedules: (employeeId) => schedulesCache.get(employeeId) ?? [],
    getOccupiedSlots: (employeeId, date) =>
      slotsCache.get(`${employeeId}-${date.toDateString()}`) ?? [],
  };

  let payloads;
  try {
    payloads = buildItemPayloads(salonId, startTime, validAssignments, ctx);
  } catch (error) {
    return err((error as Error).message);
  }

  const totalEnd = payloads[payloads.length - 1].end_time;
  const globalViolations = evaluateTimeRange({
    start: startTime,
    end: totalEnd,
    salonConfig: resources.salonConfig,
    businessHours: resources.businessHours as BusinessHour[],
    enforceSalonSchedule: true,
    enforceMinDuration: true,
  });

  if (globalViolations.length > 0) {
    return err(globalViolations[0].message);
  }

  const rpcPayload: CreateAppointmentRpcPayload = {
    salon_id: salonId,
    customer_id: input.customer_id,
    created_by: userId,
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

  let created: Awaited<ReturnType<typeof createAppointmentWithRpc>>;
  try {
    created = await createAppointmentWithRpc(rpcPayload);
  } catch (error) {
    captureError(error, { module: "appointments", action: "create" });
    return err("Error al crear la cita. Intenta de nuevo.");
  }

  if (!created.ok) {
    if (created.errorMessage?.includes("no_overlap_per_employee")) {
      return err("El profesional ya tiene una cita en ese horario. Elige otro horario.");
    }
    return err("Error al crear la cita. Intenta de nuevo.");
  }

  return ok(created.appointmentId as string);
}
