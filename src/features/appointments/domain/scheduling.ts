import { PublicError } from "@/infra/public-error";
import { addMinutes } from "@/infra/format/dates";
import { evaluateTimeRange } from "./availability";
import type {
  AppointmentItemPayload,
  BusinessHour,
  OccupiedSlot,
  SalonConfig,
  ServiceAssignment,
  WorkSchedule,
} from "./types";

export interface SchedulingContext {
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
  getWorkSchedules: (employeeId: string) => WorkSchedule[];
  getOccupiedSlots: (employeeId: string, date: Date) => OccupiedSlot[];
  /** Días libres puntuales del profesional (YYYY-MM-DD en zona del salon). */
  getExceptionDates?: (employeeId: string) => string[];
  excludeAppointmentId?: string;
}

function validateAssignment(
  assignment: ServiceAssignment,
  salonId: string
): void {
  if (assignment.service.salon_id !== salonId) {
    throw new PublicError("El servicio no pertenece al salón.");
  }
  if (!assignment.service.is_active) {
    throw new PublicError(`El servicio no está activo.`);
  }
  if (assignment.employee.salon_id !== salonId) {
    throw new PublicError("El profesional no pertenece al salón.");
  }
  if (!assignment.employee.is_active) {
    throw new PublicError("El profesional no está activo.");
  }
  if (!assignment.employee.service_ids.includes(assignment.service.id)) {
    throw new PublicError("El profesional seleccionado no realiza ese servicio.");
  }
  if (!assignment.employee.category_ids.includes(assignment.service.category_id)) {
    throw new PublicError("El profesional seleccionado no atiende esa categoría.");
  }
}

// Builds item payloads using a sequential cursor (services chain one after another).
// Per-item: validates employee schedule + overlap only.
// Global validation (salon hours, notice, min duration) is done once by the use-case.
export function buildItemPayloads(
  salonId: string,
  startTime: Date,
  assignments: ServiceAssignment[],
  ctx: SchedulingContext
): AppointmentItemPayload[] {
  if (assignments.length === 0) {
    throw new PublicError("Selecciona al menos un servicio.");
  }

  let cursor = startTime;
  const payloads: AppointmentItemPayload[] = [];

  assignments.forEach((assignment, index) => {
    validateAssignment(assignment, salonId);

    const end = addMinutes(cursor, assignment.service.duration_minutes);
    const workSchedules = ctx.getWorkSchedules(assignment.employee.id);
    const occupiedSlots = ctx.getOccupiedSlots(assignment.employee.id, cursor);

    const violations = evaluateTimeRange({
      start: cursor,
      end,
      salonConfig: ctx.salonConfig,
      businessHours: ctx.businessHours,
      workSchedules,
      occupiedSlots,
      employeeExceptionDates: ctx.getExceptionDates?.(assignment.employee.id) ?? [],
      enforceSalonSchedule: false,
      enforceMinDuration: false,
    });

    const [firstViolation] = violations;
    if (firstViolation) {
      throw new PublicError(firstViolation.message);
    }

    payloads.push({
      service_id: assignment.service.id,
      employee_id: assignment.employee.id,
      start_time: cursor,
      end_time: end,
      duration_minutes: assignment.service.duration_minutes,
      price: assignment.service.price,
      ordering: index + 1,
    });

    cursor = end;
  });

  return payloads;
}
