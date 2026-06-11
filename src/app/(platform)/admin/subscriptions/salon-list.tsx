"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, Search } from "lucide-react";

import type { SalonSubscriptionRow } from "@/features/billing/use-cases/salon-subscriptions";
import { cn } from "@/lib/utils/cn";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  trialing: { label: "Trial", className: "bg-sky-50 text-sky-700" },
  active: { label: "Activo", className: "bg-emerald-50 text-emerald-700" },
  past_due: { label: "Moroso", className: "bg-amber-50 text-amber-700" },
  paused: { label: "Pausado", className: "bg-stone-100 text-stone-500" },
  canceled: { label: "Cancelado", className: "bg-red-50 text-red-600" },
};

export function SalonSubscriptionList({
  rows,
  selectedSalonId,
  hrefBase = "/admin/subscriptions",
}: {
  rows: SalonSubscriptionRow[];
  selectedSalonId: string | null;
  hrefBase?: string;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? rows.filter((row) =>
        row.salonName.toLowerCase().includes(normalizedQuery) ||
        (row.planName ?? "").toLowerCase().includes(normalizedQuery)
      )
    : rows;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-brand-100 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar salon o plan..."
            className="h-10 w-full rounded-xl border border-brand-100 bg-white pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-400">
            No hay salones que coincidan con la busqueda.
          </p>
        ) : (
          filtered.map((row) => {
            const status = row.status ? STATUS_LABELS[row.status] : null;
            const isSelected = row.salonId === selectedSalonId;
            return (
              <Link
                key={row.salonId}
                href={`${hrefBase}?salon=${row.salonId}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 transition",
                  isSelected
                    ? "border-brand-300 bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-600)]"
                    : "border-transparent hover:border-brand-100 hover:bg-white"
                )}
              >
                <span className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                  isSelected ? "border-brand-200 bg-white text-brand-700" : "border-stone-200 bg-white text-stone-400"
                )}>
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-stone-950">{row.salonName}</span>
                    {row.openAlertCount > 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Alertas abiertas" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-stone-400">
                    {row.planName
                      ? `${row.planName} · ${row.currency} ${row.monthlyTotal.toFixed(2)}/mes${row.extrasCount > 0 ? ` · ${row.extrasCount} extras` : ""}`
                      : "Sin plan asignado"}
                  </span>
                </span>
                {status ? (
                  <span className={cn("rounded-lg px-2 py-1 text-xs font-semibold", status.className)}>
                    {status.label}
                  </span>
                ) : (
                  <span className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-400">
                    Sin plan
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
