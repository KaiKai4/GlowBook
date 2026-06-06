import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCustomersPage } from "@/features/customers/use-cases/get-customers-page";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para ver clientes.</p>
      </div>
    );
  }

  const view = await getCustomersPage({
    salonId: profile.salon_id,
    status: "active",
  });

  return <CustomersClient initialView={view} />;
}
