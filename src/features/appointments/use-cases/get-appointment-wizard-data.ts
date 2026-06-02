import "server-only";

import { findCustomers } from "@/features/customers/data/customers.repo";
import { findEmployees } from "@/features/employees/data/employees.repo";
import { findBusinessHours, findAppointmentSalonConfig } from "@/features/salon/data/salon.repo";
import { findCategoriesWithServices } from "@/features/services/data/services.repo";
import type {
  AppointmentWizardData,
  EmployeeOption,
  ServiceOption,
} from "../view-models";

type AssignedRef = {
  service?: { id: string } | null;
  category?: { id: string } | null;
};

type WorkScheduleRef = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export async function getAppointmentWizardData(salonId: string): Promise<AppointmentWizardData> {
  const [customersResult, categories, employees, salonConfig, businessHours] =
    await Promise.all([
      findCustomers(salonId, { perPage: 200, isActive: true }),
      findCategoriesWithServices(salonId),
      findEmployees(salonId, true),
      findAppointmentSalonConfig(salonId),
      findBusinessHours(salonId),
    ]);

  const customers = customersResult.data.map((customer) => ({
    id: customer.id,
    name: `${customer.first_name} ${customer.last_name}`,
  }));
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  const services: ServiceOption[] = categories.flatMap((category) =>
    (category.services ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      category_id: category.id,
      duration_minutes: service.duration_minutes,
      price: Number(service.price),
    }))
  );
  const employeeOptions: EmployeeOption[] = employees.map((employee) => ({
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`,
    service_ids: ((employee.services ?? []) as AssignedRef[])
      .map((service) => service.service?.id)
      .filter((id): id is string => Boolean(id)),
    category_ids: ((employee.categories ?? []) as AssignedRef[])
      .map((category) => category.category?.id)
      .filter((id): id is string => Boolean(id)),
    work_schedules: ((employee.work_schedules ?? []) as WorkScheduleRef[]).map((schedule) => ({
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      is_active: schedule.is_active,
    })),
  }));

  return {
    customers,
    categories: categoryOptions,
    services,
    employees: employeeOptions,
    salonConfig: {
      min_booking_notice_minutes: salonConfig?.min_booking_notice_minutes ?? 0,
      min_appointment_duration_minutes: salonConfig?.min_appointment_duration_minutes ?? 30,
      allow_off_hours_bookings: salonConfig?.allow_off_hours_bookings ?? false,
      timezone: salonConfig?.timezone ?? "America/Panama",
    },
    businessHours: businessHours.map((hours) => ({
      day_of_week: hours.day_of_week,
      is_open: hours.is_open,
      open_time: hours.open_time,
      close_time: hours.close_time,
    })),
    ready: services.length > 0 && employeeOptions.length > 0,
  };
}
