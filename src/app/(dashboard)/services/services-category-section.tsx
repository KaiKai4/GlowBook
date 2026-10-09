import { Tags, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Category, ServiceItem } from "./services-types";
import { ServiceCard } from "./service-card";

export function ServicesCategorySection({
  category,
  pricingPending,
  pricingCategoryId,
  onTogglePricingMode,
  onCreateService,
  onEditService,
  onArchiveCategory,
  archivePending,
  archiveCategoryId,
}: {
  category: Category;
  pricingPending: boolean;
  pricingCategoryId: string | null;
  onTogglePricingMode: (category: Category) => void;
  onCreateService: (categoryId: string) => void;
  onEditService: (service: ServiceItem) => void;
  onArchiveCategory: (category: Category) => void;
  archivePending: boolean;
  archiveCategoryId: string | null;
}) {
  const deleting = archivePending && archiveCategoryId === category.id;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-fg-secondary">{category.name}</h2>
        <button
          type="button"
          onClick={() => onTogglePricingMode(category)}
          disabled={pricingPending && pricingCategoryId === category.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors disabled:opacity-60",
            category.pricing_mode === "variable"
              ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
              : "border-border bg-surface-muted text-fg-muted hover:bg-surface-sunken"
          )}
          title="Cambiar modo de precio de la categoria"
        >
          <Tags className="h-3 w-3" />
          {category.pricing_mode === "variable" ? "Precio variable" : "Precio fijo"}
        </button>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-sunken px-1.5 text-xs font-medium text-fg-muted">
          {category.services.length}
        </span>
        <button
          onClick={() => onCreateService(category.id)}
          className="ml-auto text-xs text-accent-strong hover:underline"
        >
          + Agregar
        </button>
        <button
          type="button"
          onClick={() => onArchiveCategory(category)}
          disabled={deleting}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-danger-subtle hover:text-danger-strong disabled:cursor-not-allowed disabled:opacity-50"
          title="Archivar categoria"
          aria-label={`Archivar categoria ${category.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {category.services.length === 0 ? (
        <p className="text-sm text-fg-subtle">Sin servicios en esta categoria.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {category.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              pricingMode={category.pricing_mode}
              onEdit={() => onEditService(service)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
