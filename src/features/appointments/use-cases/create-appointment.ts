import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import {
  findAppointmentCreationResources,
  findEmployeeExceptionDatesForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
} from "../data/appointment-commands.repo";
import {
  createAppointmentWithRpc,
  type CreateAppointmentRpcPayload,
} from "../data/rpc/create-appointment";
import { evaluateTimeRange } from "../domain/availability";
import { buildItemPayloads } from "../domain/scheduling";
import type { SchedulingContext } from "../domain/scheduling";
import type { BusinessHour, OccupiedSlot, ServiceAssignment, WorkSchedule } from "../domain/types";
import type { CreateAppointmentInput } from "../schemas";

interface Deps {
  salonId: string;
  userId: string;
  /** Clave de idempotencia del formulario (uuid). Un reenvio no crea una segunda cita. */
  idempotencyKey: string;
}

const INACTIVE_CUSTOMER_MESSAGE =
  "Este cliente no esta disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.";

function toRpcNewCustomer(customer: NonNullable<CreateAppointmentInput["new_customer"]>) {
  const phone = customer.phone?.trim();
  return {
    first_name: customer.first_name,
    last_name: customer.last_name,
    ...(phone ? { phone } : {}),
  };
}

export async function createAppointment(
  input: CreateAppointmentInput,
  { salonId, userId, idempotencyKey }: Deps
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

  // Con cliente nuevo no hay id que comprobar: la RPC lo resuelve en la misma transaccion.
  if (input.customer_id !== undefined && !resources.customerExists) {
    return err("Cliente no encontrado en este salón.");
  }
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
            salonId,
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
    getExceptionDates: (employeeId) => exceptionsCache.get(employeeId) ?? [],
  };

  let payloads;
  try {
    payloads = buildItemPayloads(salonId, startTime, validAssignments, ctx);
  } catch (error) {
    return err(toPublicErrorMessage(error, "Error al crear la cita. Intenta de nuevo."));
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

  const rpcPayload: CreateAppointmentRpcPayload = {
    salon_id: salonId,
    ...(input.new_customer
      ? { new_customer: toRpcNewCustomer(input.new_customer) }
      : { customer_id: input.customer_id }),
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
    created = await createAppointmentWithRpc({ payload: rpcPayload, idempotencyKey });
  } catch (error) {
    captureError(error, { module: "appointments", action: "create" });
    return err("Error al crear la cita. Intenta de nuevo.");
  }

  if (!created.ok) {
    if (created.errorMessage?.includes("no_overlap_per_employee")) {
      return err("El profesional ya tiene una cita en ese horario. Elige otro horario.");
    }
    if (created.errorMessage?.includes("no esta disponible para nuevas citas")) {
      return err(INACTIVE_CUSTOMER_MESSAGE);
    }
    return err("Error al crear la cita. Intenta de nuevo.");
  }

  return ok(created.appointmentId as string);
}
