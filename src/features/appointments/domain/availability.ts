import { getZonedTimeParts, timeToMinutes } from "@/lib/utils/dates";
import type {
  BusinessHour,
  OccupiedSlot,
  RangeEvaluationInput,
  TimeWindow,
  ValidationViolation,
  WorkSchedule,
} from "./types";

const DEFAULT_HOURS: Omit<BusinessHour, "day_of_week">[] = [
  { is_open: true, open_time: "08:00", close_time: "18:00" },
  { is_open: true, open_time: "08:00", close_time: "18:00" },
  { is_open: true, open_time: "08:00", close_time: "18:00" },
  { is_open: true, open_time: "08:00", close_time: "18:00" },
  { is_open: true, open_time: "08:00", close_time: "18:00" },
  { is_open: true, open_time: "08:00", close_time: "18:00" },
  { is_open: false, open_time: null, close_time: null },
];

function mergeWindows(windows: TimeWindow[]): TimeWindow[] {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) =>
    timeToMinutes(a.start) - timeToMinutes(b.start)
  );
  const merged: TimeWindow[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (timeToMinutes(sorted[i].start) <= timeToMinutes(last.end)) {
      last.end = timeToMinutes(sorted[i].end) > timeToMinutes(last.end)
        ? sorted[i].end
        : last.end;
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

function getSalonWindows(dayOfWeek: number, businessHours: BusinessHour[]): TimeWindow[] {
  const config =
    businessHours.find((h) => h.day_of_week === dayOfWeek) ??
    { ...DEFAULT_HOURS[dayOfWeek], day_of_week: dayOfWeek };

  if (!config.is_open || !config.open_time || !config.close_time) return [];
  return [{ start: config.open_time, end: config.close_time }];
}

function getEmployeeWindows(dayOfWeek: number, schedules: WorkSchedule[]): TimeWindow[] {
  const windows = schedules
    .filter((s) => s.is_active && s.day_of_week === dayOfWeek)
    .map((s) => ({ start: s.start_time, end: s.end_time }));
  return mergeWindows(windows);
}

export function getEffectiveWindows(
  date: Date,
  timezone: string,
  businessHours: BusinessHour[],
  workSchedules: WorkSchedule[],
  allowOffHours: boolean
): TimeWindow[] {
  const { dayOfWeek } = getZonedTimeParts(date, timezone);
  const salonWindows = getSalonWindows(dayOfWeek, businessHours);
  const employeeWindows = getEmployeeWindows(dayOfWeek, workSchedules);

  if (employeeWindows.length === 0) return salonWindows;
  if (allowOffHours) return employeeWindows;

  const intersection: TimeWindow[] = [];
  for (const salonWindow of salonWindows) {
    for (const employeeWindow of employeeWindows) {
      const start = timeToMinutes(salonWindow.start) > timeToMinutes(employeeWindow.start)
        ? salonWindow.start
        : employeeWindow.start;
      const end = timeToMinutes(salonWindow.end) < timeToMinutes(employeeWindow.end)
        ? salonWindow.end
        : employeeWindow.end;
      if (timeToMinutes(start) < timeToMinutes(end)) {
        intersection.push({ start, end });
      }
    }
  }
  return intersection;
}

function isWithinWindows(
  startMinutes: number,
  endMinutes: number,
  windows: TimeWindow[]
): boolean {
  return windows.some(
    (window) =>
      startMinutes >= timeToMinutes(window.start) &&
      endMinutes <= timeToMinutes(window.end)
  );
}

function overlapsSlot(start: Date, end: Date, slot: OccupiedSlot): boolean {
  const slotStart = new Date(slot.start_time);
  const slotEnd = new Date(slot.end_time);
  return start < slotEnd && end > slotStart;
}

// Pure domain function: returns all violations for rich UI feedback.
// All wall-clock comparisons use the salon's timezone, never the server local time.
export function evaluateTimeRange({
  start,
  end,
  salonConfig,
  businessHours,
  workSchedules = [],
  occupiedSlots = [],
  enforceSalonSchedule = true,
  enforceMinDuration = true,
}: RangeEvaluationInput): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;

  if (enforceMinDuration && durationMinutes < salonConfig.min_appointment_duration_minutes) {
    violations.push({
      code: "min_duration",
      message: `La duracion minima es ${salonConfig.min_appointment_duration_minutes} minutos.`,
    });
  }

  const { dayOfWeek, minutesOfDay: startMins } = getZonedTimeParts(start, salonConfig.timezone);
  const endMins = startMins + durationMinutes;

  if (enforceSalonSchedule) {
    const salonWindows = getSalonWindows(dayOfWeek, businessHours);
    if (salonWindows.length === 0) {
      violations.push({ code: "salon_closed_day", message: "El salon esta cerrado ese dia." });
    } else if (!isWithinWindows(startMins, endMins, salonWindows)) {
      violations.push({
        code: "salon_off_hours",
        message: "El horario esta fuera del horario de atencion del salon.",
      });
    }
  }

  if (workSchedules.length > 0) {
    const employeeWindows = getEmployeeWindows(dayOfWeek, workSchedules);
    if (employeeWindows.length === 0) {
      violations.push({ code: "employee_day_off", message: "El profesional no trabaja ese dia." });
    } else if (!isWithinWindows(startMins, endMins, employeeWindows)) {
      violations.push({
        code: "employee_outside_hours",
        message: "El horario esta fuera del turno del profesional.",
      });
    }
  }

  for (const slot of occupiedSlots) {
    if (overlapsSlot(start, end, slot)) {
      violations.push({ code: "occupied", message: "El profesional ya tiene una cita en ese horario." });
      break;
    }
  }

  return violations;
}
