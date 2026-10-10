import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { BusinessHour, SalonConfig } from "../domain/types";
import type {
  AppointmentCreationAssignmentRequest,
  AppointmentCreationResources,
} from "./appointment-command-types";

export async function findAppointmentCreationResources({
  salonId,
  customerId,
  assignments,
}: {
  salonId: string;
  /** Ausente con cliente nuevo: todavia no existe y la RPC lo da de alta. */
  customerId?: string;
  assignments: AppointmentCreationAssignmentRequest[];
}): Promise<AppointmentCreationResources> {
  const supabase = await createSupabaseServerClient();
  const serviceIds = [...new Set(assignments.map((assignment) => assignment.service_id))];
  const employeeIds = [...new Set(assignments.map((assignment) => assignment.employee_id))];

  const [customerResult, salonResult, businessHoursResult, servicesResult, employeesResult] =
    await Promise.all([
      customerId === undefined
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("customers")
            .select("id")
            .eq("id", customerId)
            .eq("salon_id", salonId)
            .maybeSingle(),
      supabase
        .from("salons")
        .select(
          "min_booking_notice_minutes, min_appointment_duration_minutes, allow_off_hours_bookings, timezone"
        )
        .eq("id", salonId)
        .maybeSingle(),
      supabase
        .from("salon_business_hours")
        .select("day_of_week, is_open, open_time, close_time")
        .eq("salon_id", salonId),
      supabase
        .from("services")
        .select("id, salon_id, duration_minutes, price, is_active, category_id")
        .in("id", serviceIds)
        .eq("salon_id", salonId),
      supabase
        .from("employees")
        .select("id, salon_id, is_active, profile_id")
        .in("id", employeeIds)
        .eq("salon_id", salonId),
    ]);

  if (customerResult.error) throw customerResult.error;
  if (salonResult.error) throw salonResult.error;
  if (businessHoursResult.error) throw businessHoursResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (employeesResult.error) throw employeesResult.error;

  if (!customerResult.data || !salonResult.data) {
    return {
      customerExists: Boolean(customerResult.data),
      salonConfig: (salonResult.data as SalonConfig | null) ?? null,
      businessHours: (businessHoursResult.data ?? []) as BusinessHour[],
      assignments: [],
    };
  }

  const [employeeServicesResult, employeeCategoriesResult] = await Promise.all([
    supabase
      .from("employee_services")
      .select("employee_id, service_id")
      .in("employee_id", employeeIds)
      .in("service_id", serviceIds)
      .eq("salon_id", salonId),
    supabase
      .from("employee_categories")
      .select("employee_id, category_id")
      .in("employee_id", employeeIds)
      .eq("salon_id", salonId),
  ]);

  if (employeeServicesResult.error) throw employeeServicesResult.error;
  if (employeeCategoriesResult.error) throw employeeCategoriesResult.error;

  const serviceIdsByEmployee = new Map<string, string[]>();
  for (const row of employeeServicesResult.data ?? []) {
    const list = serviceIdsByEmployee.get(row.employee_id) ?? [];
    list.push(row.service_id);
    serviceIdsByEmployee.set(row.employee_id, list);
  }

  const categoryIdsByEmployee = new Map<string, string[]>();
  for (const row of employeeCategoriesResult.data ?? []) {
    const list = categoryIdsByEmployee.get(row.employee_id) ?? [];
    list.push(row.category_id);
    categoryIdsByEmployee.set(row.employee_id, list);
  }

  const serviceMap = new Map(
    (servicesResult.data ?? []).map((service) => [
      service.id,
      {
        id: service.id,
        duration_minutes: service.duration_minutes,
        price: Number(service.price),
        salon_id: service.salon_id,
        is_active: service.is_active,
        category_id: service.category_id,
      },
    ])
  );
  const employeeMap = new Map(
    (employeesResult.data ?? []).map((employee) => [
      employee.id,
      {
        id: employee.id,
        salon_id: employee.salon_id,
        is_active: employee.is_active,
        profile_id: employee.profile_id,
        service_ids: serviceIdsByEmployee.get(employee.id) ?? [],
        category_ids: categoryIdsByEmployee.get(employee.id) ?? [],
      },
    ])
  );

  return {
    customerExists: true,
    salonConfig: salonResult.data as SalonConfig,
    businessHours: (businessHoursResult.data ?? []) as BusinessHour[],
    assignments: assignments.map((assignment) => ({
      service: serviceMap.get(assignment.service_id) ?? null,
      employee: employeeMap.get(assignment.employee_id) ?? null,
    })),
  };
}
