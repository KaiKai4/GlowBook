import { Clock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/infra/format/dates";
import type { ServiceItem } from "./services-types";

export function ServiceCard({
  service,
  pricingMode,
  onEdit,
}: {
  service: ServiceItem;
  pricingMode: "fixed" | "variable";
  onEdit: () => void;
}) {
  return (
    <div className="group rounded-xl border border-border-subtle bg-surface p-4 transition-all hover:border-border hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-fg">{service.name}</p>
          {service.description && (
            <p className="mt-1 line-clamp-2 text-xs text-fg-subtle">{service.description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={onEdit}
          title="Editar servicio"
          aria-label={`Editar ${service.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-fg-muted">
          <Clock className="h-3 w-3" />
          {service.duration_minutes} min
        </span>
        <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent-strong">
          {formatCurrency(service.price)}
        </span>
        {service.is_active ? (
          <StatusBadge variant="success" label="Activo" />
        ) : (
          <StatusBadge variant="neutral" label="Inactivo" />
        )}
        {pricingMode === "variable" && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            Variable al cobrar
          </span>
        )}
      </div>
      {service.employees.length > 0 && (
        <div className="mt-3 flex -space-x-1.5">
          {service.employees.slice(0, 5).map((employee) => (
            <span
              key={employee.id}
              title={employee.name}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-brand-100 text-xs font-semibold text-brand-700"
            >
              {employee.initials}
            </span>
          ))}
          {service.employees.length > 5 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-sunken text-xs font-semibold text-fg-muted">
              +{service.employees.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
