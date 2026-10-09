import { requireProfile } from "@/infra/auth/session";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { getServiceCatalog } from "@/features/services/use-cases/get-service-catalog";
import { ServicesManager } from "./services-manager";

export default async function ServicesPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.SERVICES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar servicios.</p>
      </div>
    );
  }

  const categories = await getServiceCatalog(profile.salon_id);
  return <ServicesManager categories={categories} />;
}
