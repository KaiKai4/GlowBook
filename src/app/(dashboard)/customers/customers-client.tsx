"use client";

import { FormEvent, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewCustomerModal } from "./new-customer-modal";
import { CustomersList } from "./customers-list";
import {
  getCustomersPageAction,
  type CustomersPageActionView,
} from "./actions";

export function CustomersClient({
  initialView,
}: {
  initialView: CustomersPageActionView;
}) {
  const [view, setView] = useState(initialView);
  const [queryInput, setQueryInput] = useState(initialView.query);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadCustomers(next: { q?: string; page?: number }) {
    setError(null);
    startTransition(async () => {
      const result = await getCustomersPageAction(next);
      if (result.ok) {
        setView(result.value);
      } else {
        setError(result.error);
      }
    });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadCustomers({ q: queryInput, page: 1 });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clientes</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {view.total} clientes activos
          </p>
        </div>
        <NewCustomerModal />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Buscar por nombre, telefono o email..."
          spellCheck={false}
          className="h-9 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <Button type="submit" variant="outline" loading={pending}>
          Buscar
        </Button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className={pending ? "space-y-2 opacity-70 transition-opacity" : "space-y-2 transition-opacity"}>
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
              <button
                type="button"
                onClick={() => loadCustomers({ q: view.query, page: view.page - 1 })}
                disabled={pending}
                className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
            ) : (
              <span className="flex items-center gap-1 rounded-lg border border-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-300">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </span>
            )}
            {view.page < view.totalPages ? (
              <button
                type="button"
                onClick={() => loadCustomers({ q: view.query, page: view.page + 1 })}
                disabled={pending}
                className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
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
