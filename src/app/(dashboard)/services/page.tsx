import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findServicesCatalog } from "@/features/services/data/services.repo";
import { ServicesManager } from "./services-manager";

interface EmpRef { employee: { id: string; first_name: string; last_name: string } | null }

export default async function ServicesPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.SERVICES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar servicios.</p>
      </div>
    );
  }

  const catalog = await findServicesCatalog(profile.salon_id);

  const categories = catalog.map((c) => ({
    id: c.id,
    name: c.name,
    services: (c.services ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price: Number(s.price),
      is_active: s.is_active,
      employees: ((s.employee_services ?? []) as EmpRef[])
        .map((es) => es.employee)
        .filter((e): e is { id: string; first_name: string; last_name: string } => e !== null)
        .map((e) => ({ id: e.id, initials: `${e.first_name[0] ?? ""}${e.last_name[0] ?? ""}`.toUpperCase(), name: `${e.first_name} ${e.last_name}` })),
    })),
  }));

  return <ServicesManager categories={categories} />;
}
