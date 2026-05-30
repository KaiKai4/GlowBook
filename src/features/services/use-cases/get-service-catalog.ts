import "server-only";

import { findServicesCatalog } from "../data/services.repo";

interface EmployeeRef {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
  } | null;
}

export interface ServiceCatalogEmployeeBadge {
  id: string;
  initials: string;
  name: string;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  employees: ServiceCatalogEmployeeBadge[];
}

export interface ServiceCatalogCategory {
  id: string;
  name: string;
  services: ServiceCatalogItem[];
}

function toInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export async function getServiceCatalog(salonId: string): Promise<ServiceCatalogCategory[]> {
  const catalog = await findServicesCatalog(salonId);

  return catalog.map((category) => ({
    id: category.id,
    name: category.name,
    services: (category.services ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: Number(service.price),
      is_active: service.is_active,
      employees: ((service.employee_services ?? []) as EmployeeRef[])
        .map((assignment) => assignment.employee)
        .filter(
          (employee): employee is NonNullable<EmployeeRef["employee"]> =>
            employee !== null && employee.is_active
        )
        .map((employee) => ({
          id: employee.id,
          initials: toInitials(employee.first_name, employee.last_name),
          name: `${employee.first_name} ${employee.last_name}`,
        })),
    })),
  }));
}
