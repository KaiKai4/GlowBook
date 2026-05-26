import type {
  BusinessHour,
  SalonConfig,
  WorkSchedule,
} from "@/features/appointments/domain/types";

export interface CustomerOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ServiceOption {
  id: string;
  name: string;
  category_id: string;
  duration_minutes: number;
  price: number;
}

export interface EmployeeOption {
  id: string;
  name: string;
  service_ids: string[];
  category_ids: string[];
  work_schedules: WorkSchedule[];
}

export interface AppointmentServiceRow {
  key: string;
  categoryId: string;
  serviceId: string;
  employeeId: string;
}

export type OccupiedByEmployee = Record<string, { start_time: string; end_time: string }[]>;

export interface AppointmentScheduleItem {
  row: AppointmentServiceRow;
  service: ServiceOption | undefined;
  start: Date | null;
  end: Date | null;
}

export interface SalonWindow {
  open: string;
  close: string;
}

export interface AppointmentWizardProps {
  customers: CustomerOption[];
  categories: CategoryOption[];
  services: ServiceOption[];
  employees: EmployeeOption[];
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
}
