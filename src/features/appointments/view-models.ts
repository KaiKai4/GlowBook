import type { BusinessHour, SalonConfig, WorkSchedule } from "./domain/types";
import type { CalendarView } from "./domain/calendar";
import type { AppointmentStatus } from "./domain/lifecycle";
import type { PaymentMethodOption } from "@/features/payments";
import type { PricingMode } from "./domain/pricing";

export type { CalendarView };

export interface CalendarAppointment {
  id: string;
  status: AppointmentStatus;
  start_time: string | null;
  end_time: string | null;
  total_price: number | string | null;
  discount_amount: number | string | null;
  completion_price_note: string | null;
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
    discount_amount: number;
    service: {
      id: string;
      name: string;
      duration_minutes: number;
      category: { id: string; name: string; pricing_mode: PricingMode } | null;
    } | null;
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
  paymentMethodOptions: PaymentMethodOption[];
}

export interface CustomerOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  pricing_mode?: PricingMode;
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
