import { Tags } from "lucide-react";
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
}: {
  category: Category;
  pricingPending: boolean;
  pricingCategoryId: string | null;
  onTogglePricingMode: (category: Category) => void;
  onCreateService: (categoryId: string) => void;
  onEditService: (service: ServiceItem) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-800">{category.name}</h2>
        <button
          type="button"
          onClick={() => onTogglePricingMode(category)}
          disabled={pricingPending && pricingCategoryId === category.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-60",
            category.pricing_mode === "variable"
              ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
              : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
          )}
          title="Cambiar modo de precio de la categoria"
        >
          <Tags className="h-3 w-3" />
          {category.pricing_mode === "variable" ? "Precio variable" : "Precio fijo"}
        </button>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-xs font-medium text-neutral-500">
          {category.services.length}
        </span>
        <button
          onClick={() => onCreateService(category.id)}
          className="ml-auto text-xs text-rose-600 hover:underline"
        >
          + Agregar
        </button>
      </div>
      {category.services.length === 0 ? (
        <p className="text-sm text-neutral-400">Sin servicios en esta categoria.</p>
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
