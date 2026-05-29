import type { BusinessHour, SalonConfig, WorkSchedule } from "./domain/types";
import type { CalendarView } from "./domain/calendar";

export type { CalendarView };

export interface CalendarAppointment {
  id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  total_price: number | string | null;
  notes: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    is_temporary: boolean;
  } | null;
  items: Array<{
    id: string;
    start_time: string;
    end_time: string;
    price: number;
    service: { id: string; name: string; duration_minutes: number } | null;
    employee: { id: string; first_name: string; last_name: string } | null;
  }>;
}

export interface CalendarEmployee {
  id: string;
  first_name: string;
  last_name: string;
}

export interface CalendarViewModel {
  date: string;
  view: CalendarView;
  showWorkerView: boolean;
  dateLabel: string;
  activeCount: number;
  appointments: CalendarAppointment[];
  timezone: string;
  employees: CalendarEmployee[];
  visibleWeekDates: string[];
  businessStart: number;
  businessEnd: number;
  salonName: string;
  cancellationTemplate: string;
}

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

export interface AppointmentWizardData {
  customers: CustomerOption[];
  categories: CategoryOption[];
  services: ServiceOption[];
  employees: EmployeeOption[];
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
  ready: boolean;
}
