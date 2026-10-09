import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PanelProps {
  /** Título de la sección (h2), opcional. */
  title?: string;
  /** Acciones de la cabecera, opcionales. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, actions, className, children }: PanelProps) {
  const hasHeader = title !== undefined || (actions !== undefined && actions !== null);

  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      {hasHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
          {title !== undefined && <h2 className="text-base font-semibold text-fg-strong">{title}</h2>}
          {actions !== undefined && actions !== null && (
            <div className="flex flex-wrap gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
