import { evaluateTimeRange } from "@/features/appointments/domain/availability";
import type {
  BusinessHour,
  SalonConfig,
} from "@/features/appointments/domain/types";
import { addMinutes, getZonedTimeParts } from "@/lib/utils/dates";
import type {
  AppointmentScheduleItem,
  AppointmentServiceRow,
  EmployeeOption,
  OccupiedByEmployee,
  SalonWindow,
  ServiceOption,
} from "./appointment-wizard-types";

export function createAppointmentRow(seq: number): AppointmentServiceRow {
  return {
    key: `r${seq}`,
    categoryId: "",
    serviceId: "",
    employeeId: "",
  };
}

export function salonWindowFor(
  dateStr: string,
  timezone: string,
  businessHours: BusinessHour[]
): SalonWindow | null {
  if (!dateStr) return null;

  const dayOfWeek = getZonedTimeParts(new Date(`${dateStr}T12:00:00Z`), timezone).dayOfWeek;
  const config = businessHours.find((hour) => hour.day_of_week === dayOfWeek);

  if (!config || !config.is_open || !config.open_time || !config.close_time) return null;

  return {
    open: config.open_time.slice(0, 5),
    close: config.close_time.slice(0, 5),
  };
}

export function buildSequentialSchedule({
  rows,
  date,
  time,
  serviceMap,
}: {
  rows: AppointmentServiceRow[];
  date: string;
  time: string;
  serviceMap: Map<string, ServiceOption>;
}): AppointmentScheduleItem[] {
  if (!date) return [];

  const base = new Date(`${date}T${time}:00`);

  return rows.reduce<AppointmentScheduleItem[]>((schedule, row) => {
    const service = serviceMap.get(row.serviceId);
    const start = schedule.length ? schedule[schedule.length - 1].end : base;
    const end = service && start ? addMinutes(start, service.duration_minutes) : start;
    return [...schedule, { row, service, start, end }];
  }, []);
}

export function findEligibleEmployees({
  serviceId,
  start,
  end,
  employees,
  serviceMap,
  salonConfig,
  businessHours,
  occupied,
}: {
  serviceId: string;
  start: Date | null;
  end: Date | null;
  employees: EmployeeOption[];
  serviceMap: Map<string, ServiceOption>;
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
  occupied: OccupiedByEmployee;
}): EmployeeOption[] {
  const service = serviceMap.get(serviceId);
  if (!service) return [];

  const candidates = employees.filter(
    (employee) =>
      employee.service_ids.includes(serviceId) &&
      employee.category_ids.includes(service.category_id)
  );

  if (!start || !end) return candidates;

  return candidates.filter((employee) => {
    const violations = evaluateTimeRange({
      start,
      end,
      salonConfig,
      businessHours,
      workSchedules: employee.work_schedules,
      occupiedSlots: occupied[employee.id] ?? [],
      enforceSalonSchedule: false,
      enforceNotice: false,
      enforceMinDuration: false,
    });

    return violations.length === 0;
  });
}
