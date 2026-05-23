import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findCustomers } from "@/features/customers/data/customers.repo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Phone, Mail } from "lucide-react";

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
        <Link href="/customers/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </Link>
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
          customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">
                      {customer.first_name} {customer.last_name}
                      {customer.is_temporary && (
                        <Badge variant="warning" className="ml-2">Temporal</Badge>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {customer.phone && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-xs text-rose-600 hover:underline shrink-0"
                  >
                    Ver ficha
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
