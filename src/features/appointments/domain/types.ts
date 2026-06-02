export interface TimeWindow {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

export interface BusinessHour {
  day_of_week: number; // 0=Monday ... 6=Sunday
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export interface WorkSchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface SalonConfig {
  min_booking_notice_minutes: number;
  min_appointment_duration_minutes: number;
  allow_off_hours_bookings: boolean;
  timezone: string;
}

export interface OccupiedSlot {
  start_time: string; // ISO string
  end_time: string;
}

export type ValidationCode =
  | "min_duration"
  | "employee_day_off"
  | "employee_outside_hours"
  | "occupied"
  | "salon_closed_day"
  | "salon_off_hours";

export interface ValidationViolation {
  code: ValidationCode;
  message: string;
}

export interface RangeEvaluationInput {
  start: Date;
  end: Date;
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
  workSchedules?: WorkSchedule[];
  occupiedSlots?: OccupiedSlot[];
  excludeAppointmentId?: string;
  enforceSalonSchedule?: boolean;
  enforceMinDuration?: boolean;
}

export interface ServiceAssignment {
  service: {
    id: string;
    duration_minutes: number;
    price: number;
    salon_id: string;
    is_active: boolean;
    category_id: string;
  };
  employee: {
    id: string;
    salon_id: string;
    is_active: boolean;
    profile_id: string | null;
    service_ids: string[];
    category_ids: string[];
  };
}

export interface AppointmentItemPayload {
  service_id: string;
  employee_id: string;
  start_time: Date;
  end_time: Date;
  duration_minutes: number;
  price: number;
  ordering: number;
}
