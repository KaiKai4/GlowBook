import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCustomersPage } from "@/features/customers/use-cases/get-customers-page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewCustomerModal } from "./new-customer-modal";
import { CustomersList } from "./customers-list";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
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

  const view = await getCustomersPage({
    salonId: profile.salon_id,
    q: params.q,
    page: params.page,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clientes</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {view.total} clientes {view.isArchived ? "archivados" : "activos"}
          </p>
        </div>
        {!view.isArchived && <NewCustomerModal />}
      </div>

      <div className="flex gap-2">
        <Link
          href={view.statusHref("active")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            !view.isArchived
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          }`}
        >
          Activos
        </Link>
        <Link
          href={view.statusHref("archived")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            view.isArchived
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          }`}
        >
          Archivados
        </Link>
      </div>

      <form action="/customers" className="flex gap-2">
        {view.isArchived && <input type="hidden" name="status" value="archived" />}
        <input
          type="search"
          name="q"
          defaultValue={view.query}
          placeholder="Buscar por nombre, telefono o email..."
          className="h-9 flex-1 rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <div className="space-y-2">
        {view.customers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-neutral-400">
                {view.query ? "No se encontraron clientes." : "Aun no hay clientes."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <CustomersList customers={view.customers} mode={view.mode} />
        )}
      </div>

      {view.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
          <p className="text-xs text-neutral-400">
            Pagina {view.page} de {view.totalPages}
          </p>
          <div className="flex gap-2">
            {view.page > 1 ? (
              <Link
                href={view.pageHref(view.page - 1)}
                className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Link>
            ) : (
              <span className="flex items-center gap-1 rounded-lg border border-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-300">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </span>
            )}
            {view.page < view.totalPages ? (
              <Link
                href={view.pageHref(view.page + 1)}
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
