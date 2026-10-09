import type { Database } from "@/types/database.types";
import type { AppointmentStatus } from "../domain/lifecycle";
import type {
  BusinessHour,
  OccupiedSlot,
  SalonConfig,
  ServiceAssignment,
} from "../domain/types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

export type AppointmentPaymentMethod = AppointmentRow["payment_method"];

export interface AppointmentCommandState {
  id: string;
  salon_id: string;
  status: AppointmentStatus;
  customer_id: string | null;
}

export interface AppointmentCreationAssignmentRequest {
  service_id: string;
  employee_id: string;
}

export interface AppointmentCreationResources {
  customerExists: boolean;
  salonConfig: SalonConfig | null;
  businessHours: BusinessHour[];
  assignments: Array<{
    service: ServiceAssignment["service"] | null;
    employee: ServiceAssignment["employee"] | null;
  }>;
}

export type OccupiedByEmployee = Record<string, OccupiedSlot[]>;
