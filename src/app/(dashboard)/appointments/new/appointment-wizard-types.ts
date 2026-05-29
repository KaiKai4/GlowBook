import type {
  AppointmentWizardData,
  CategoryOption,
  CustomerOption,
  EmployeeOption,
  ServiceOption,
} from "@/features/appointments/view-models";

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

export type AppointmentWizardProps = Omit<AppointmentWizardData, "ready">;
export type { CategoryOption, CustomerOption, EmployeeOption, ServiceOption };
