import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { requireInvariant } from "@/infra/invariant";
import { toResult } from "@/infra/to-result";
import {
  findAppointmentCreationResources,
  findExceptionDatesByEmployeeForCommand,
  findOccupiedSlotsByEmployeeForCommand,
  findWorkSchedulesByEmployeeForCommand,
} from "../data/appointment-commands.repo";
import type {
  AppointmentCreationAssignmentRequest,
  AppointmentCreationResources,
} from "../data/appointment-command-types";
import type { CreateAppointmentRpcPayload } from "../data/rpc/create-appointment";
import { evaluateTimeRange } from "../domain/availability";
import { buildItemPayloads, type SchedulingContext } from "../domain/scheduling";
import type {
  AppointmentItemPayload,
  OccupiedSlot,
  ServiceAssignment,
  WorkSchedule,
} from "../domain/types";
import { APPOINTMENT_MESSAGES } from "../domain/messages";

/** Item de cita tal como lo espera la RPC de creación y de reprogramación. */
type AppointmentRpcItem = CreateAppointmentRpcPayload["items"][number];

export interface PreparedAppointmentItems {
  items: AppointmentRpcItem[];
  startTime: Date;
}

/** Lecturas que necesita la preparación. Producción usa los repos; los tests inyectan fakes. */
export interface PrepareAppointmentItemsDeps {
  findAppointmentCreationResources: typeof findAppointmentCreationResources;
  findExceptionDatesByEmployeeForCommand: typeof findExceptionDatesByEmployeeForCommand;
  findOccupiedSlotsByEmployeeForCommand: typeof findOccupiedSlotsByEmployeeForCommand;
  findWorkSchedulesByEmployeeForCommand: typeof findWorkSchedulesByEmployeeForCommand;
}

const defaultPrepareAppointmentItemsDeps: PrepareAppointmentItemsDeps = {
  findAppointmentCreationResources,
  findExceptionDatesByEmployeeForCommand,
  findOccupiedSlotsByEmployeeForCommand,
  findWorkSchedulesByEmployeeForCommand,
};

export interface PrepareAppointmentItemsInput {
  salonId: string;
  /** Ausente con cliente nuevo: todavía no existe y la RPC lo da de alta. */
  customerId?: string;
  assignments: AppointmentCreationAssignmentRequest[];
  /** Inicio de la cita en ISO. */
  startTime: string;
  /** Cita que se reprograma: sus propios bloques no cuentan como ocupados. */
  excludeAppointmentId?: string;
  /** Servicios inactivos que la cita ya tenía: solo se aceptan al actualizar. */
  allowedInactiveServiceIds?: ReadonlySet<string>;
  action: "create" | "update";
}

/**
 * Preparación común de crear y reprogramar: carga recursos, valida asignaciones,
 * consulta horarios, excepciones y ocupación en lote, calcula los items y valida
 * el rango global. No escribe nada.
 */
export async function prepareAppointmentItems(
  input: PrepareAppointmentItemsInput,
  deps: PrepareAppointmentItemsDeps = defaultPrepareAppointmentItemsDeps
): Promise<Result<PreparedAppointmentItems>> {
  const { salonId, action } = input;
  const fallbackMessage =
    action === "create" ? APPOINTMENT_MESSAGES.createFailed : APPOINTMENT_MESSAGES.updateFailed;

  let resources: AppointmentCreationResources;
  try {
    resources = await deps.findAppointmentCreationResources({
      salonId,
      customerId: input.customerId,
      assignments: input.assignments,
    });
  } catch (error) {
    captureError(error, { module: "appointments", action });
    return err(APPOINTMENT_MESSAGES.invalidData);
  }

  if (input.customerId !== undefined && !resources.customerExists) {
    return err(APPOINTMENT_MESSAGES.customerNotFound);
  }
  if (!resources.salonConfig) return err(APPOINTMENT_MESSAGES.salonNotFound);

  if (resources.assignments.some((assignment) => !assignment.service || !assignment.employee)) {
    return err(APPOINTMENT_MESSAGES.resourceNotFound);
  }

  const validAssignments = resources.assignments as ServiceAssignment[];
  const startTime = new Date(input.startTime);
  const employeeIds = [...new Set(validAssignments.map(({ employee }) => employee.id))];
  const timezone = resources.salonConfig.timezone;

  let ctx: SchedulingContext;
  try {
    // Tres consultas en lote para todos los profesionales, en paralelo.
    const [schedules, exceptions, occupied] = await Promise.all([
      deps.findWorkSchedulesByEmployeeForCommand({ salonId, employeeIds }),
      deps.findExceptionDatesByEmployeeForCommand({ salonId, employeeIds }),
      deps.findOccupiedSlotsByEmployeeForCommand({
        salonId,
        employeeIds,
        date: startTime,
        timezone,
        excludeAppointmentId: input.excludeAppointmentId,
      }),
    ]);

    const startDay = startTime.toDateString();
    ctx = {
      salonConfig: resources.salonConfig,
      businessHours: resources.businessHours,
      getWorkSchedules: (employeeId): WorkSchedule[] => schedules.get(employeeId) ?? [],
      // La ocupación se cargó solo para el día de inicio: otros días no tienen bloques conocidos.
      getOccupiedSlots: (employeeId, date): OccupiedSlot[] =>
        date.toDateString() === startDay ? (occupied.get(employeeId) ?? []) : [],
      getExceptionDates: (employeeId) => exceptions.get(employeeId) ?? [],
      excludeAppointmentId: input.excludeAppointmentId,
      allowedInactiveServiceIds: input.allowedInactiveServiceIds,
    };
  } catch (error) {
    captureError(error, { module: "appointments", action });
    return err(APPOINTMENT_MESSAGES.availabilityFailed);
  }

  let payloads: AppointmentItemPayload[];
  try {
    payloads = buildItemPayloads(salonId, startTime, validAssignments, ctx);
  } catch (error) {
    return err(toPublicErrorMessage(error, fallbackMessage));
  }

  // buildItemPayloads devuelve un item por asignación: sin items no hay fin que calcular.
  const lastPayload = await toResult(
    async () => requireInvariant(payloads.at(-1), "Invariante de cita: sin items para calcular el fin."),
    { fallback: fallbackMessage, context: { module: "appointments", action } }
  );
  if (!lastPayload.ok) return lastPayload;

  const [firstGlobalViolation] = evaluateTimeRange({
    start: startTime,
    end: lastPayload.value.end_time,
    salonConfig: resources.salonConfig,
    businessHours: resources.businessHours,
    enforceSalonSchedule: true,
    enforceMinDuration: true,
  });
  if (firstGlobalViolation) {
    return err(firstGlobalViolation.message);
  }

  const items: AppointmentRpcItem[] = payloads.map((payload) => ({
    salon_id: salonId,
    service_id: payload.service_id,
    employee_id: payload.employee_id,
    start_time: payload.start_time.toISOString(),
    end_time: payload.end_time.toISOString(),
    duration_minutes: payload.duration_minutes,
    price: payload.price,
    ordering: payload.ordering,
    blocks_calendar: true,
  }));

  return ok({ items, startTime });
}
