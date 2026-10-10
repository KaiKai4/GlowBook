import "server-only";

import { getActiveCustomerOptions } from "@/features/customers";
import { getEmployeeSchedulingOptions } from "@/features/employees";
import { getSalonSchedulingConfig } from "@/features/salon";
import { getServiceSchedulingOptions } from "@/features/services";
import type { AppointmentWizardData } from "../view-models";

/** Clientes que se ofrecen en el asistente de nueva cita. */
const CUSTOMER_OPTIONS_LIMIT = 200;

/**
 * Datos del asistente. En edición, `assignedServiceIds` son los servicios que la
 * cita ya tiene: se ofrecen aunque estén inactivos, para no obligar a cambiarlos.
 */
export async function getAppointmentWizardData(
  salonId: string,
  assignedServiceIds: readonly string[] = []
): Promise<AppointmentWizardData> {
  const [customers, serviceSchedulingOptions, salonSchedulingConfig] = await Promise.all([
    getActiveCustomerOptions(salonId, CUSTOMER_OPTIONS_LIMIT),
    getServiceSchedulingOptions(salonId, assignedServiceIds),
    getSalonSchedulingConfig(salonId),
  ]);

  const activeServiceIds = new Set(serviceSchedulingOptions.services.map((service) => service.id));
  const employeeOptions = await getEmployeeSchedulingOptions(salonId, activeServiceIds);

  return {
    customers,
    categories: serviceSchedulingOptions.categories,
    services: serviceSchedulingOptions.services,
    employees: employeeOptions,
    salonConfig: salonSchedulingConfig.salonConfig,
    businessHours: salonSchedulingConfig.businessHours,
    ready: serviceSchedulingOptions.services.length > 0 && employeeOptions.length > 0,
  };
}
