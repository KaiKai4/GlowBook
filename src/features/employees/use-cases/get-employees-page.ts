import "server-only";

import { findRolesWithPermissions } from "@/features/access/data/roles.repo";
import { findCategoriesWithServices } from "@/features/services/data/services.repo";
import { findEmployees } from "../data/employees.repo";

type EmployeeCategoryRef = {
  category: { id: string; name: string } | null;
};

export type EmployeesPageMode = "active" | "archived";

export interface EmployeeListItemViewModel {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile_id: string | null;
  serviceCount: number;
  categories: string[];
  categoryIds: string[];
}

export interface EmployeeCategoryOptionViewModel {
  id: string;
  name: string;
  services: { id: string; name: string }[];
}

export interface EmployeeRoleOptionViewModel {
  id: string;
  name: string;
}

export interface EmployeesPageViewModel {
  employees: EmployeeListItemViewModel[];
  categories: EmployeeCategoryOptionViewModel[];
  roles: EmployeeRoleOptionViewModel[];
  mode: EmployeesPageMode;
}

export interface GetEmployeesPageInput {
  salonId: string;
  rolesEnabled: boolean;
  status?: string;
}

export async function getEmployeesPage({
  salonId,
  rolesEnabled,
  status,
}: GetEmployeesPageInput): Promise<EmployeesPageViewModel> {
  const mode: EmployeesPageMode = status === "archived" ? "archived" : "active";
  const isArchived = mode === "archived";

  const [employees, categories, allRoles] = await Promise.all([
    findEmployees(salonId, !isArchived),
    findCategoriesWithServices(salonId),
    rolesEnabled ? findRolesWithPermissions(salonId) : Promise.resolve([]),
  ]);

  return {
    mode,
    employees: employees.map((employee) => {
      const assignedCategories = (employee.categories ?? []) as EmployeeCategoryRef[];

      return {
        id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        is_active: employee.is_active,
        profile_id: employee.profile_id,
        serviceCount: (employee.services ?? []).length,
        categories: assignedCategories
          .map((assignment) => assignment.category?.name)
          .filter((name): name is string => Boolean(name)),
        categoryIds: assignedCategories
          .map((assignment) => assignment.category?.id)
          .filter((id): id is string => Boolean(id)),
      };
    }),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      services: (category.services ?? []).map((service) => ({
        id: service.id,
        name: service.name,
      })),
    })),
    roles: allRoles
      .filter((role) => !role.is_system)
      .map((role) => ({ id: role.id, name: role.name })),
  };
}
