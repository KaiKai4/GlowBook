import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findCustomers } from "@/features/customers/data/customers.repo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewCustomerModal } from "./new-customer-modal";
import { CustomersList } from "./customers-list";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PER_PAGE = 20;

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

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const { data: customers, total } = await findCustomers(profile.salon_id, {
    q: params.q,
    page,
    perPage: PER_PAGE,
    isActive: true,
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    sp.set("page", String(n));
    return `/customers?${sp.toString()}`;
  };

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

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
          <p className="text-xs text-neutral-400">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Link>
            ) : (
              <span className="flex items-center gap-1 rounded-lg border border-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-300">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex items-center gap-1 rounded-lg border border-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-300">
                Siguiente <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
