// Fixtures con la forma real de los view-models de la agenda y del asistente de
// citas. Zona horaria fija (Panamá, UTC-5 sin horario de verano) para que los
// tests no dependan de la zona del equipo que los ejecuta.
import type { AppointmentStatus } from "@/features/appointments/domain/lifecycle";
import type { BusinessHour, SalonConfig, WorkSchedule } from "@/features/appointments/domain/types";
import type {
  AppointmentWizardData,
  CalendarAppointment,
  CalendarEmployee,
  CustomerOption,
  EmployeeOption,
  ServiceOption,
} from "@/features/appointments/view-models";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";

export const SALON_TZ = "America/Panama";

/** Lunes 12 de octubre de 2026 en la zona del salón. */
export const TEST_DATE = "2026-10-12";

export const PAYMENT_OPTIONS: PaymentMethodOption[] = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
];

const SALON_CONFIG: SalonConfig = {
  min_booking_notice_minutes: 0,
  min_appointment_duration_minutes: 15,
  allow_off_hours_bookings: false,
  timezone: SALON_TZ,
};

/** Salón abierto de 08:00 a 18:00 de lunes a sábado; domingo cerrado. */
const BUSINESS_HOURS: BusinessHour[] = [
  ...Array.from({ length: 6 }, (_, day_of_week) => ({
    day_of_week,
    is_open: true,
    open_time: "08:00",
    close_time: "18:00",
  })),
  { day_of_week: 6, is_open: false, open_time: null, close_time: null },
];

function allWeekSchedule(start: string, end: string): WorkSchedule[] {
  return Array.from({ length: 7 }, (_, day_of_week) => ({
    day_of_week,
    start_time: start,
    end_time: end,
    is_active: true,
  }));
}

/** Cita de ejemplo a las 14:00 (hora de Panamá) de la fecha de prueba. */
export function buildCalendarAppointment(
  overrides: Partial<CalendarAppointment> = {}
): CalendarAppointment {
  const start = `${TEST_DATE}T14:00:00-05:00`;
  const end = `${TEST_DATE}T15:00:00-05:00`;
  return {
    id: "appt-1",
    status: "scheduled" satisfies AppointmentStatus,
    start_time: start,
    end_time: end,
    total_price: 25,
    discount_amount: 0,
    completion_price_note: null,
    notes: null,
    customer: {
      id: "cust-1",
      first_name: "Ana",
      last_name: "Pérez",
      phone: "61234567",
      email: null,
      is_temporary: false,
    },
    items: [
      {
        id: "item-1",
        start_time: start,
        end_time: end,
        price: 25,
        discount_amount: 0,
        service: {
          id: "svc-corte",
          name: "Corte",
          duration_minutes: 60,
          category: { id: "cat-cabello", name: "Cabello", pricing_mode: "fixed" },
        },
        employee: { id: "emp-1", first_name: "Lucía", last_name: "Gómez" },
      },
    ],
    ...overrides,
  };
}

export function buildEmployees(): CalendarEmployee[] {
  return [
    { id: "emp-1", first_name: "Lucía", last_name: "Gómez" },
    { id: "emp-2", first_name: "Marta", last_name: "Ruiz" },
  ];
}

export const WIZARD_CATEGORIES = [
  { id: "cat-cabello", name: "Cabello", pricing_mode: "fixed" as const },
  { id: "cat-unas", name: "Uñas", pricing_mode: "fixed" as const },
];

export const WIZARD_SERVICES: ServiceOption[] = [
  { id: "svc-corte", name: "Corte", category_id: "cat-cabello", duration_minutes: 60, price: 25 },
  { id: "svc-tinte", name: "Tinte", category_id: "cat-cabello", duration_minutes: 90, price: 40 },
  { id: "svc-manicura", name: "Manicura", category_id: "cat-unas", duration_minutes: 45, price: 15 },
];

export const WIZARD_EMPLOYEES: EmployeeOption[] = [
  {
    id: "emp-1",
    name: "Lucía Gómez",
    service_ids: ["svc-corte", "svc-tinte"],
    category_ids: ["cat-cabello"],
    work_schedules: allWeekSchedule("08:00", "18:00"),
  },
  {
    id: "emp-2",
    name: "Marta Ruiz",
    service_ids: ["svc-corte", "svc-manicura"],
    category_ids: ["cat-cabello", "cat-unas"],
    work_schedules: allWeekSchedule("08:00", "18:00"),
  },
];

const WIZARD_CUSTOMERS: CustomerOption[] = [
  { id: "cust-1", name: "Ana Pérez" },
  { id: "cust-2", name: "Carlos Mora" },
];

export function buildWizardProps(
  overrides: Partial<Omit<AppointmentWizardData, "ready">> = {}
): Omit<AppointmentWizardData, "ready"> {
  return {
    customers: WIZARD_CUSTOMERS,
    categories: WIZARD_CATEGORIES,
    services: WIZARD_SERVICES,
    employees: WIZARD_EMPLOYEES,
    salonConfig: SALON_CONFIG,
    businessHours: BUSINESS_HOURS,
    ...overrides,
  };
}
