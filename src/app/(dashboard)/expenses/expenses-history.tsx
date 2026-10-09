"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ExpenseHistoryItem } from "@/features/expenses/use-cases/expenses";
import { isHttpsReceiptUrl } from "@/features/expenses/domain/receipt-url";
import { formatCurrency } from "@/lib/utils/dates";

type ExpenseTypeFilter = "all" | "manual" | "inventory_purchase";

export function ExpensesHistory({ history }: { history: ExpenseHistoryItem[] }) {
  const [query, setQuery] = useState("");
  const [conceptFilter, setConceptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ExpenseTypeFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedConcept = conceptFilter.trim().toLowerCase();

    return history.filter((item) => {
      const haystack = [
        item.concept,
        item.categoryLabel,
        item.detail,
        item.commerceName ?? "",
        item.note ?? "",
        item.amount,
        expenseTypeLabel(item.type),
      ].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesConcept = !normalizedConcept || item.concept.toLowerCase().includes(normalizedConcept);
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesFrom = !fromDate || item.date >= fromDate;
      const matchesTo = !toDate || item.date <= toDate;
      return matchesQuery && matchesConcept && matchesType && matchesFrom && matchesTo;
    });
  }, [conceptFilter, fromDate, history, query, toDate, typeFilter]);
  const filteredTotal = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.7fr_0.7fr]">
          <Input
            label="Buscar"
            placeholder="Comercio, nota, producto..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Input
            label="Concepto"
            placeholder="Luz, inventario, equipo..."
            value={conceptFilter}
            onChange={(event) => setConceptFilter(event.target.value)}
          />
          <Select
            label="Tipo de egreso"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as ExpenseTypeFilter)}
          >
            <option value="all">Todos</option>
            <option value="manual">Gasto general</option>
            <option value="inventory_purchase">Compra de inventario</option>
          </Select>
          <Input label="Desde" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input label="Hasta" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Historial de egresos</CardTitle>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase text-fg-subtle">Total filtrado</p>
              <p className="text-lg font-semibold text-danger">{formatCurrency(filteredTotal)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border-subtle">
            <div className="grid grid-cols-[1fr_120px_120px] gap-3 bg-surface-muted px-4 py-3 text-xs font-semibold uppercase text-fg-subtle md:grid-cols-[130px_170px_1fr_180px_140px]">
              <span>Fecha</span>
              <span>Tipo</span>
              <span>Detalle</span>
              <span className="hidden md:block">Comercio / empresa</span>
              <span className="text-right">Monto</span>
            </div>
            {filteredExpenses.map((item) => (
              <div
                key={`${item.type}:${item.id}`}
                className="grid grid-cols-[1fr_120px_120px] gap-3 border-t border-border-subtle px-4 py-3 text-sm md:grid-cols-[130px_170px_1fr_180px_140px]"
              >
                <span className="text-fg-subtle">
                  {new Date(`${item.date}T12:00:00`).toLocaleDateString("es-PA")}
                </span>
                <span>
                  <span
                    className={
                      item.type === "inventory_purchase"
                        ? "rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700"
                        : "rounded-full bg-surface-sunken px-2 py-1 text-xs font-semibold text-fg-muted"
                    }
                  >
                    {expenseTypeLabel(item.type)}
                  </span>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-fg-muted">
                      {item.categoryLabel}
                    </span>
                    {isHttpsReceiptUrl(item.receiptUrl) && (
                      <a
                        href={item.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        Ver comprobante
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">{item.detail}</p>
                </div>
                <span className="hidden truncate text-fg-subtle md:block">
                  {item.commerceName || "Sin registrar"}
                </span>
                <span className="text-right font-semibold text-danger">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            {filteredExpenses.length === 0 && (
              <p className="border-t border-border-subtle px-4 py-8 text-center text-sm text-fg-subtle">
                No hay egresos con esos filtros.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function expenseTypeLabel(type: "manual" | "inventory_purchase") {
  return type === "inventory_purchase" ? "Compra de inventario" : "Gasto general";
}
