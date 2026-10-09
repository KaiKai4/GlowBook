import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Título de la pantalla; se renderiza dentro del único h1 de la página. */
  title: ReactNode;
  /** Texto de apoyo bajo el título, opcional. */
  description?: ReactNode;
  /** Acciones de la pantalla (botones); a la derecha en escritorio, apiladas en móvil. */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-fg-strong">{title}</h1>
        {description !== undefined && description !== null && (
          <p className="mt-1 text-sm text-fg-muted">{description}</p>
        )}
      </div>
      {actions !== undefined && actions !== null && (
        <div className="flex flex-wrap gap-2">{actions}</div>
      )}
    </div>
  );
}
