import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findCustomers } from "@/features/customers/data/customers.repo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewCustomerModal } from "./new-customer-modal";
import { CustomersList } from "./customers-list";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para ver clientes.</p>
      </div>
    );
  }

  const page = Number(params.page ?? 1);
  const { data: customers, total } = await findCustomers(profile.salon_id, {
    q: params.q,
    page,
    isActive: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clientes</h1>
          <p className="text-sm text-neutral-500 mt-1">{total} clientes activos</p>
        </div>
        <NewCustomerModal />
      </div>

      <form action="/customers" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por nombre, teléfono o email..."
          className="h-9 flex-1 rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>

      <div className="space-y-2">
        {customers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-neutral-400">
                {params.q ? "No se encontraron clientes." : "Aún no hay clientes."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <CustomersList customers={customers} />
        )}
      </div>
    </div>
  );
}
