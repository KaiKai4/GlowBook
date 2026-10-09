import { requireProfile } from "@/infra/auth/session";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
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

  const rolesEnabled = await isEffectiveSalonModuleEnabled(profile, "roles");
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
