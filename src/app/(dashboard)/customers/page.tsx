import { requireProfile } from "@/app/_composition/request-context";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { getCustomersPage } from "@/features/customers/use-cases/get-customers-page";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para ver clientes.</p>
      </div>
    );
  }

  const params = await searchParams;
  const view = await getCustomersPage({
    salonId: profile.salon_id,
    q: params.q,
    page: params.page,
    status: "active",
  });

  return <CustomersClient key={`${view.query}:${view.page}`} initialView={view} />;
}
