import { addMinutes } from "@/lib/utils/dates";
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
  excludeAppointmentId?: string;
}

function validateAssignment(
  assignment: ServiceAssignment,
  salonId: string
): void {
  if (assignment.service.salon_id !== salonId) {
    throw new Error("El servicio no pertenece al salón.");
  }
  if (!assignment.service.is_active) {
    throw new Error(`El servicio no está activo.`);
  }
  if (assignment.employee.salon_id !== salonId) {
    throw new Error("El profesional no pertenece al salón.");
  }
  if (!assignment.employee.is_active) {
    throw new Error("El profesional no está activo.");
  }
  if (!assignment.employee.service_ids.includes(assignment.service.id)) {
    throw new Error("El profesional seleccionado no realiza ese servicio.");
  }
  if (!assignment.employee.category_ids.includes(assignment.service.category_id)) {
    throw new Error("El profesional seleccionado no atiende esa categoría.");
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
    throw new Error("Selecciona al menos un servicio.");
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
      enforceSalonSchedule: false,
      enforceMinDuration: false,
    });

    if (violations.length > 0) {
      throw new Error(violations[0].message);
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
