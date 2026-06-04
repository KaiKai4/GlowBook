import "server-only";

import { getActiveCustomerOptions } from "@/features/customers/use-cases/customer-options";
import { getEmployeeSchedulingOptions } from "@/features/employees/use-cases/employee-scheduling-options";
import { getSalonSchedulingConfig } from "@/features/salon/use-cases/salon-scheduling-config";
import { getServiceSchedulingOptions } from "@/features/services/use-cases/service-scheduling-options";
import type { AppointmentWizardData } from "../view-models";

export async function getAppointmentWizardData(salonId: string): Promise<AppointmentWizardData> {
  const [customers, serviceSchedulingOptions, salonSchedulingConfig] = await Promise.all([
    getActiveCustomerOptions(salonId, 200),
    getServiceSchedulingOptions(salonId),
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
