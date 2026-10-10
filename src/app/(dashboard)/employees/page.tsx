import { getRolesEnabled, requireProfile } from "@/app/_composition/request-context";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { getEmployeesPage } from "@/features/employees/use-cases/get-employees-page";
import { EmployeesManager } from "./employees-manager";

export default async function EmployeesPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar colaboradores.</p>
      </div>
    );
  }

  const rolesEnabled = await getRolesEnabled();
  const view = await getEmployeesPage({
    salonId: profile.salon_id,
    rolesEnabled,
    status: "active",
  });

  return (
    <EmployeesManager
      employees={view.employees}
      categories={view.categories}
      roles={view.roles}
      mode={view.mode}
    />
  );
}
