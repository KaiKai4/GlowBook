import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findEmployees } from "@/features/employees/data/employees.repo";
import { findCategoriesWithServices } from "@/features/services/data/services.repo";
import { EmployeesManager } from "./employees-manager";

export default async function EmployeesPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar colaboradores.</p>
      </div>
    );
  }

  const [employees, categories] = await Promise.all([
    findEmployees(profile.salon_id),
    findCategoriesWithServices(profile.salon_id),
  ]);

  const employeeList = employees.map((e) => ({
    id: e.id,
    first_name: e.first_name,
    last_name: e.last_name,
    is_active: e.is_active,
    serviceCount: (e.services ?? []).length,
    categories: ((e.categories ?? []) as Array<{ category: { id: string; name: string } | null }>)
      .map((c) => c.category?.name)
      .filter((n): n is string => !!n),
    categoryIds: ((e.categories ?? []) as Array<{ category: { id: string; name: string } | null }>)
      .map((c) => c.category?.id)
      .filter((id): id is string => !!id),
  }));

  const catOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
    services: (c.services ?? []).map((s) => ({ id: s.id, name: s.name })),
  }));

  return <EmployeesManager employees={employeeList} categories={catOptions} />;
}
