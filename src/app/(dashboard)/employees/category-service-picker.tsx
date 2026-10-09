"use client";

import { cn } from "@/components/ui/cn";
import type { CategoryOption } from "./types";

interface CategoryServicePickerProps {
  categories: CategoryOption[];
  categoryIds: string[];
  serviceIds: string[];
  onCategoryIdsChange: (ids: string[]) => void;
  onServiceIdsChange: (ids: string[]) => void;
  renderHiddenInputs?: boolean;
  categoryTitle?: string;
  serviceTitle?: string;
  emptyCategoryMessage?: string;
}

export function CategoryServicePicker({
  categories,
  categoryIds,
  serviceIds,
  onCategoryIdsChange,
  onServiceIdsChange,
  renderHiddenInputs = false,
  categoryTitle = "Categorías que atiende",
  serviceTitle = "Servicios que realiza",
  emptyCategoryMessage = "No hay categorías configuradas.",
}: CategoryServicePickerProps) {
  const selectedCategories = categories.filter((category) => categoryIds.includes(category.id));

  function toggleCategory(categoryId: string) {
    const nextCategoryIds = categoryIds.includes(categoryId)
      ? categoryIds.filter((id) => id !== categoryId)
      : [...categoryIds, categoryId];

    const allowedServiceIds = new Set(
      categories
        .filter((category) => nextCategoryIds.includes(category.id))
        .flatMap((category) => category.services.map((service) => service.id))
    );

    onCategoryIdsChange(nextCategoryIds);
    onServiceIdsChange(serviceIds.filter((serviceId) => allowedServiceIds.has(serviceId)));
  }

  function toggleService(serviceId: string) {
    onServiceIdsChange(
      serviceIds.includes(serviceId)
        ? serviceIds.filter((id) => id !== serviceId)
        : [...serviceIds, serviceId]
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-fg-secondary">{categoryTitle}</p>
        {categories.length === 0 ? (
          <p className="text-xs text-fg-subtle">{emptyCategoryMessage}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const selected = categoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-border text-fg-muted hover:bg-surface-muted"
                  )}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedCategories.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-fg-secondary">{serviceTitle}</p>
          <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-brand-100 bg-brand-50/30 p-3">
            {selectedCategories.map((category) => (
              <div key={category.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">{category.name}</p>
                {category.services.length === 0 ? (
                  <p className="mt-1 text-xs text-fg-subtle">Sin servicios en esta categoria.</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {category.services.map((service) => (
                      <label
                        key={service.id}
                        className="flex cursor-pointer items-center gap-2 text-sm text-fg-secondary hover:text-fg"
                      >
                        <input
                          type="checkbox"
                          checked={serviceIds.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                          className="rounded accent-brand-600"
                        />
                        {service.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {renderHiddenInputs && (
        <>
          {categoryIds.map((id) => (
            <input key={`category-${id}`} type="hidden" name="category_ids" value={id} />
          ))}
          {serviceIds.map((id) => (
            <input key={`service-${id}`} type="hidden" name="service_ids" value={id} />
          ))}
        </>
      )}
    </div>
  );
}
