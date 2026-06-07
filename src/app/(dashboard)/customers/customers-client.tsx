"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
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
  const pageBeforeSearch = useRef(initialView.page);
  const firstVisibleCustomer =
    view.total === 0 ? 0 : (view.page - 1) * view.pageSize + 1;
  const lastVisibleCustomer = Math.min(
    view.page * view.pageSize,
    view.total,
  );

  function loadCustomers(next: { q?: string; page?: number }) {
    if (pending) return;

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
    const query = queryInput.trim();

    if (query) {
      if (!view.query) pageBeforeSearch.current = view.page;
      loadCustomers({ q: query, page: 1 });
      return;
    }

    loadCustomers({ q: "", page: pageBeforeSearch.current });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clientes</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {view.query
              ? `${view.total} ${view.total === 1 ? "resultado" : "resultados"}`
              : `${view.total} clientes activos`}
          </p>
        </div>
        <NewCustomerModal />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={queryInput}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQueryInput(nextQuery);

            if (!nextQuery.trim() && view.query) {
              loadCustomers({ q: "", page: pageBeforeSearch.current });
            }
          }}
          placeholder="Buscar por nombre, teléfono o correo..."
          aria-label="Buscar clientes por nombre, teléfono o correo"
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

      <div
        aria-busy={pending}
        className={
          pending
            ? "space-y-2 opacity-70 transition-opacity"
            : "space-y-2 transition-opacity"
        }
      >
        {view.customers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-neutral-400">
                {view.query
                  ? "No se encontraron clientes."
                  : "Aún no hay clientes."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <CustomersList customers={view.customers} mode={view.mode} />
        )}
      </div>

      {view.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <div>
            <p className="text-sm font-medium text-neutral-700">
              {firstVisibleCustomer}-{lastVisibleCustomer} de {view.total}
            </p>
            <p className="text-xs text-neutral-400">
              Página {view.page} de {view.totalPages}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                loadCustomers({ q: view.query, page: view.page - 1 })
              }
              disabled={pending || view.page === 1}
              className="flex min-h-9 items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:border-neutral-100 disabled:bg-white disabled:text-neutral-300"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                loadCustomers({ q: view.query, page: view.page + 1 })
              }
              disabled={pending || view.page === view.totalPages}
              className="flex min-h-9 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-neutral-100 disabled:bg-white disabled:text-neutral-300"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
