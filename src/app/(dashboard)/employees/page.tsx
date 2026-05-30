import { requireProfile } from "@/lib/auth/session";
import { hasPermission, hasSalonFeature, PERMISSIONS } from "@/lib/auth/permissions";
import { getEmployeesPage } from "@/features/employees/use-cases/get-employees-page";
import { EmployeesManager } from "./employees-manager";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar colaboradores.</p>
      </div>
    );
  }

  const rolesEnabled = hasSalonFeature(profile, "roles");
  const view = await getEmployeesPage({
    salonId: profile.salon_id,
    rolesEnabled,
    status: params.status,
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
