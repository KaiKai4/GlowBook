import { addMinutes, getZonedTimeParts } from "@/lib/utils/dates";
import { evaluateTimeRange } from "./availability";
import type {
  BusinessHour,
  OccupiedSlot,
  SalonConfig,
  WorkSchedule,
} from "./types";

export interface AppointmentServiceRow {
  key: string;
  categoryId: string;
  serviceId: string;
  employeeId: string;
}

export type OccupiedByEmployee = Record<string, OccupiedSlot[]>;

export interface WizardServiceOption {
  id: string;
  name: string;
  category_id: string;
  duration_minutes: number;
  price: number;
}

export interface WizardEmployeeOption {
  id: string;
  service_ids: string[];
  category_ids: string[];
  work_schedules: WorkSchedule[];
}

export interface AppointmentScheduleItem<
  TService extends WizardServiceOption = WizardServiceOption,
> {
  row: AppointmentServiceRow;
  service: TService | undefined;
  start: Date | null;
  end: Date | null;
}

export interface SalonWindow {
  open: string;
  close: string;
}

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

export function buildSequentialSchedule<TService extends WizardServiceOption>({
  rows,
  date,
  time,
  serviceMap,
}: {
  rows: AppointmentServiceRow[];
  date: string;
  time: string;
  serviceMap: Map<string, TService>;
}): AppointmentScheduleItem<TService>[] {
  if (!date) return [];

  const base = new Date(`${date}T${time}:00`);

  return rows.reduce<AppointmentScheduleItem<TService>[]>((schedule, row) => {
    const service = serviceMap.get(row.serviceId);
    const previous = schedule.at(-1);
    const start = previous ? previous.end : base;
    const end = service && start ? addMinutes(start, service.duration_minutes) : start;
    return [...schedule, { row, service, start, end }];
  }, []);
}

export function findEligibleEmployees<
  TEmployee extends WizardEmployeeOption,
  TService extends WizardServiceOption,
>({
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
  employees: TEmployee[];
  serviceMap: Map<string, TService>;
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
  occupied: OccupiedByEmployee;
}): TEmployee[] {
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
      enforceSalonSchedule: true,
      enforceMinDuration: false,
    });

    return violations.length === 0;
  });
}
