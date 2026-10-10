import { ChevronLeft, ChevronRight } from "lucide-react";

interface CategoriesPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function CategoriesPagination({ page, totalPages, pageSize, total, onPageChange }: CategoriesPaginationProps) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
      <div>
        <p className="text-sm font-medium text-fg-secondary">
          {Math.min((page - 1) * pageSize + 1, total)}
          -
          {Math.min(page * pageSize, total)}
          {" de "}
          {total}
        </p>
        <p className="text-xs text-fg-subtle">
          Página {page} de {totalPages}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors hover:border-accent-border hover:bg-accent-subtle hover:text-accent-strong disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-surface disabled:text-fg-disabled"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="flex min-h-9 items-center gap-1 rounded-lg border border-accent-border bg-accent-subtle px-3 py-1.5 text-sm font-medium text-accent-strong transition-colors hover:border-accent-border hover:bg-accent-subtle disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-surface disabled:text-fg-disabled"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
