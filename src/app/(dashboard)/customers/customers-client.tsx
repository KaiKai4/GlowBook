"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewCustomerModal } from "./new-customer-modal";
import { CustomersList } from "./customers-list";
import type { CustomersPageViewModel } from "@/features/customers";
import { buildCustomersHref } from "./customer-url";

export function CustomersClient({
  initialView,
}: {
  initialView: CustomersPageViewModel;
}) {
  const router = useRouter();
  const [queryInput, setQueryInput] = useState(initialView.query);
  const [pending, startTransition] = useTransition();
  const pageBeforeSearch = useRef(initialView.page);
  const firstVisibleCustomer =
    initialView.total === 0 ? 0 : (initialView.page - 1) * initialView.pageSize + 1;
  const lastVisibleCustomer = Math.min(
    initialView.page * initialView.pageSize,
    initialView.total,
  );

  function loadCustomers(next: { q?: string; page?: number }) {
    if (pending) return;

    startTransition(() => {
      router.replace(buildCustomersHref(next));
    });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = queryInput.trim();

    if (query) {
      if (!initialView.query) pageBeforeSearch.current = initialView.page;
      loadCustomers({ q: query, page: 1 });
      return;
    }

    loadCustomers({ q: "", page: pageBeforeSearch.current });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={
          initialView.query
            ? `${initialView.total} ${initialView.total === 1 ? "resultado" : "resultados"}`
            : `${initialView.total} clientes activos`
        }
        actions={<NewCustomerModal />}
      />

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={queryInput}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQueryInput(nextQuery);

            if (!nextQuery.trim() && initialView.query) {
              loadCustomers({ q: "", page: pageBeforeSearch.current });
            }
          }}
          placeholder="Buscar por nombre, teléfono o correo..."
          aria-label="Buscar clientes por nombre, teléfono o correo"
          spellCheck={false}
          className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <Button type="submit" variant="outline" loading={pending}>
          Buscar
        </Button>
      </form>

      <div
        aria-busy={pending}
        className={
          pending
            ? "space-y-2 opacity-70 transition-opacity"
            : "space-y-2 transition-opacity"
        }
      >
        {initialView.customers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-fg-subtle">
                {initialView.query
                  ? "No se encontraron clientes."
                  : "Aún no hay clientes."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <CustomersList customers={initialView.customers} mode={initialView.mode} />
        )}
      </div>

      {initialView.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <div>
            <p className="text-sm font-medium text-fg-secondary">
              {firstVisibleCustomer}-{lastVisibleCustomer} de {initialView.total}
            </p>
            <p className="text-xs text-fg-subtle">
              Página {initialView.page} de {initialView.totalPages}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                loadCustomers({ q: initialView.query, page: initialView.page - 1 })
              }
              disabled={pending || initialView.page === 1}
              className="flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-surface disabled:text-fg-disabled"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                loadCustomers({ q: initialView.query, page: initialView.page + 1 })
              }
              disabled={pending || initialView.page === initialView.totalPages}
              className="flex min-h-9 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-surface disabled:text-fg-disabled"
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
