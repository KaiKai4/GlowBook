"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { parseOption } from "@/components/forms/parse-option";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ExpenseHistoryItem } from "@/features/expenses";
import { isHttpsReceiptUrl } from "@/features/expenses/domain/receipt-url";
import { formatCurrency } from "@/infra/format/money";
import { z } from "@/infra/validation/zod";

const EXPENSE_TYPE_FILTER_SCHEMA = z.enum(["all", "manual", "inventory_purchase"]);
type ExpenseTypeFilter = z.infer<typeof EXPENSE_TYPE_FILTER_SCHEMA>;

const HISTORY_COLUMNS: DataTableColumn<ExpenseHistoryItem>[] = [
  {
    id: "date",
    header: "Fecha",
    cell: (item) => (
      <span className="text-fg-subtle">{new Date(`${item.date}T12:00:00`).toLocaleDateString("es-PA")}</span>
    ),
  },
  {
    id: "type",
    header: "Tipo",
    cell: (item) => (
      <StatusBadge
        variant={item.type === "inventory_purchase" ? "accent" : "neutral"}
        label={expenseTypeLabel(item.type)}
      />
    ),
  },
  {
    id: "detail",
    header: "Detalle",
    cell: (item) => (
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
    ),
  },
  {
    id: "commerce",
    header: "Comercio / empresa",
    secondary: true,
    cell: (item) => <span className="truncate text-fg-subtle">{item.commerceName || "Sin registrar"}</span>,
  },
  {
    id: "amount",
    header: "Monto",
    align: "right",
    cell: (item) => <span className="font-semibold text-danger-strong">{formatCurrency(item.amount)}</span>,
  },
];

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
  // La paginación de DataTable es local y no se reinicia sola: al cambiar cualquier
  // filtro se remonta la tabla para volver a la página 1.
  const tableKey = JSON.stringify([query, conceptFilter, typeFilter, fromDate, toDate]);

  return (
    <div className="space-y-4">
      <Panel title="Filtros">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.7fr_0.7fr]">
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
            onChange={(event) => setTypeFilter(parseOption(EXPENSE_TYPE_FILTER_SCHEMA, event.target.value, typeFilter))}
          >
            <option value="all">Todos</option>
            <option value="manual">Gasto general</option>
            <option value="inventory_purchase">Compra de inventario</option>
          </Select>
          <Input label="Desde" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input label="Hasta" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </Panel>

      <Panel
        title="Historial de egresos"
        actions={
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-fg-subtle">Total filtrado</p>
            <p className="text-lg font-semibold text-danger-strong">{formatCurrency(filteredTotal)}</p>
          </div>
        }
      >
        <DataTable
          key={tableKey}
          label="Historial de egresos"
          columns={HISTORY_COLUMNS}
          rows={filteredExpenses}
          getRowId={(item) => `${item.type}:${item.id}`}
          emptyMessage="No hay egresos con esos filtros."
        />
      </Panel>
    </div>
  );
}

function expenseTypeLabel(type: "manual" | "inventory_purchase") {
  return type === "inventory_purchase" ? "Compra de inventario" : "Gasto general";
}
