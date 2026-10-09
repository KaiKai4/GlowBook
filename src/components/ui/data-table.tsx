"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const DATA_TABLE_PAGE_SIZE = 10;

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /**
   * Dato secundario: en escritorio es una columna propia; por debajo de sm se
   * muestra como segunda línea (text-sm text-fg-muted) bajo la primera columna.
   */
  secondary?: boolean;
  align?: "left" | "right";
}

interface DataTableProps<T> {
  /** Nombre accesible de la tabla. */
  label: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  emptyMessage: string;
}

function hasContent(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

export function DataTable<T>({ label, columns, rows, getRowId, emptyMessage }: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / DATA_TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * DATA_TABLE_PAGE_SIZE;
  const visibleRows = rows.slice(start, start + DATA_TABLE_PAGE_SIZE);
  const [primary, ...others] = columns;
  const secondaryColumns = others.filter((column) => column.secondary);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border-subtle">
        <table aria-label={label} className="w-full table-auto text-left">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-sm font-semibold text-fg-muted",
                    column.align === "right" && "text-right",
                    column.secondary && "hidden sm:table-cell",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-fg-subtle">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr key={getRowId(row)} className="border-t border-border-subtle hover:bg-surface-muted">
                {primary && (
                  <td className="h-13 px-4 py-2 align-middle text-fg">
                    {primary.cell(row)}
                    {secondaryColumns.map((column) => {
                      const content = column.cell(row);
                      return hasContent(content) ? (
                        <div key={column.id} className="text-sm text-fg-muted sm:hidden">
                          {content}
                        </div>
                      ) : null;
                    })}
                  </td>
                )}
                {others.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "h-13 px-4 py-2 align-middle text-fg",
                      column.align === "right" && "text-right",
                      column.secondary ? "hidden text-sm text-fg-muted sm:table-cell" : undefined,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginación de la tabla" className="flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted" aria-live="polite">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Página anterior"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-fg-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-fg-disabled"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Página siguiente"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-fg-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-fg-disabled"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
