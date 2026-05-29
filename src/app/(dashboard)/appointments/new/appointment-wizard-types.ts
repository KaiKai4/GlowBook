import type {
  AppointmentWizardData,
  CategoryOption,
  CustomerOption,
  EmployeeOption,
  ServiceOption,
} from "@/features/appointments/view-models";
export type {
  AppointmentScheduleItem,
  AppointmentServiceRow,
  OccupiedByEmployee,
  SalonWindow,
} from "@/features/appointments/domain/wizard-availability";

export type AppointmentWizardProps = Omit<AppointmentWizardData, "ready">;
export type { CategoryOption, CustomerOption, EmployeeOption, ServiceOption };
