import "server-only";

import { getAssignableRoleOptions } from "@/features/access";
import { getCategoryServiceOptions } from "@/features/services";
import { findEmployeeListRows } from "../data/employees.repo";

type EmployeeCategoryRef = {
  category: { id: string; name: string } | null;
};

type EmployeesPageMode = "active" | "archived";

interface EmployeeListItemViewModel {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile_id: string | null;
  serviceCount: number;
  categories: string[];
  categoryIds: string[];
}

interface EmployeeCategoryOptionViewModel {
  id: string;
  name: string;
  services: { id: string; name: string }[];
}

interface EmployeeRoleOptionViewModel {
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
    findEmployeeListRows(salonId, !isArchived),
    getCategoryServiceOptions(salonId),
    rolesEnabled ? getAssignableRoleOptions(salonId) : Promise.resolve([]),
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
    categories,
    roles: allRoles,
  };
}
