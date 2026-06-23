"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  archiveCategoryAction,
  createCategoryAction,
  createServiceAction,
  updateCategoryPricingModeAction,
  updateServiceAction,
} from "./actions";
import { ArchiveCategoryDialog } from "./archive-category-dialog";
import { CategoryDialog } from "./category-dialog";
import { EditServiceDialog } from "./edit-service-dialog";
import { EmptyServicesState } from "./empty-services-state";
import { NewServiceDialog } from "./new-service-dialog";
import { ServicesCategorySection } from "./services-category-section";
import { ServicesFilters } from "./services-filters";
import { ServicesSidebar } from "./services-sidebar";
import { ServicesStats } from "./services-stats";
import type { Category, ServiceItem, ServiceStatusFilter } from "./services-types";

const CATEGORIES_PER_PAGE = 3;

export function ServicesManager({ categories }: { categories: Category[] }) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [categoryPage, setCategoryPage] = useState(1);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [defaultCategory, setDefaultCategory] = useState("");

  const [categoryPending, startCategory] = useTransition();
  const [servicePending, startService] = useTransition();
  const [editPending, startEdit] = useTransition();
  const [pricingPending, startPricing] = useTransition();
  const [archivePending, startArchive] = useTransition();
  const [pricingCategoryId, setPricingCategoryId] = useState<string | null>(null);
  const [archiveCategoryId, setArchiveCategoryId] = useState<string | null>(null);
  const [categoryToArchive, setCategoryToArchive] = useState<Category | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const allServices = categories.flatMap((category) => category.services);

    return {
      categories: categories.length,
      services: allServices.length,
      inactiveServices: allServices.filter((service) => !service.is_active).length,
    };
  }, [categories]);

  const visibleCategories = useMemo(() => {
    const normalizedQuery = query.toLowerCase();

    return categories
      .filter((category) => activeCategoryId === "all" || category.id === activeCategoryId)
      .map((category) => ({
        ...category,
        services: category.services.filter((service) => {
          const matchesQuery = service.name.toLowerCase().includes(normalizedQuery);
          const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" && service.is_active) ||
            (statusFilter === "inactive" && !service.is_active);

          return matchesQuery && matchesStatus;
        }),
      }))
      .filter((category) => category.services.length > 0 || activeCategoryId === category.id);
  }, [categories, activeCategoryId, query, statusFilter]);

  const totalCategoryPages = Math.max(
    1,
    Math.ceil(visibleCategories.length / CATEGORIES_PER_PAGE)
  );
  const currentCategoryPage = Math.min(categoryPage, totalCategoryPages);
  const pagedCategories = useMemo(() => {
    const start = (currentCategoryPage - 1) * CATEGORIES_PER_PAGE;
    return visibleCategories.slice(start, start + CATEGORIES_PER_PAGE);
  }, [currentCategoryPage, visibleCategories]);

  function selectCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    setCategoryPage(1);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setCategoryPage(1);
  }

  function updateStatusFilter(nextStatus: ServiceStatusFilter) {
    setStatusFilter(nextStatus);
    setCategoryPage(1);
  }

  function handleCreateCategory(formData: FormData) {
    setCategoryError(null);
    startCategory(async () => {
      const result = await createCategoryAction(null, formData);
      if (result.ok) setCategoryDialogOpen(false);
      else setCategoryError(result.error);
    });
  }

  function handleCreateService(formData: FormData) {
    setServiceError(null);
    startService(async () => {
      const result = await createServiceAction(null, formData);
      if (result.ok) setServiceDialogOpen(false);
      else setServiceError(result.error);
    });
  }

  function handleUpdateService(formData: FormData) {
    if (!editingService) return;

    setEditError(null);
    startEdit(async () => {
      const result = await updateServiceAction(editingService.id, null, formData);
      if (result.ok) setEditingService(null);
      else setEditError(result.error);
    });
  }

  function openNewService(categoryId?: string) {
    setDefaultCategory(
      categoryId ?? (activeCategoryId !== "all" ? activeCategoryId : categories[0]?.id ?? "")
    );
    setServiceDialogOpen(true);
  }

  function openEditService(service: ServiceItem) {
    setEditError(null);
    setEditingService(service);
  }

  function closeEditService() {
    if (!editPending) setEditingService(null);
  }

  function handleToggleCategoryPricingMode(category: Category) {
    setPricingCategoryId(category.id);
    const nextMode = category.pricing_mode === "variable" ? "fixed" : "variable";

    startPricing(async () => {
      await updateCategoryPricingModeAction(category.id, nextMode);
      setPricingCategoryId(null);
    });
  }

  function handleArchiveCategory(category: Category) {
    setArchiveError(null);
    setCategoryToArchive(category);
  }

  function closeArchiveCategoryDialog() {
    if (archivePending) return;
    setArchiveError(null);
    setCategoryToArchive(null);
  }

  function confirmArchiveCategory() {
    if (!categoryToArchive) return;

    setArchiveError(null);
    setArchiveCategoryId(categoryToArchive.id);
    startArchive(async () => {
      const result = await archiveCategoryAction(categoryToArchive.id);
      if (result.ok) {
        if (activeCategoryId === categoryToArchive.id) setActiveCategoryId("all");
        setCategoryToArchive(null);
        setArchiveCategoryId(null);
        return;
      }

      setArchiveCategoryId(null);
      setArchiveError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <ServicesStats
        categoryCount={totals.categories}
        serviceCount={totals.services}
        inactiveServiceCount={totals.inactiveServices}
        canCreateService={categories.length > 0}
        onCreateService={() => openNewService()}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <ServicesSidebar
          categories={categories}
          activeCategoryId={activeCategoryId}
          totalServices={totals.services}
          onSelectCategory={selectCategory}
          onCreateCategory={() => setCategoryDialogOpen(true)}
        />

        <div className="flex min-h-[calc(100vh-208px)] flex-col space-y-6">
          <ServicesFilters
            query={query}
            statusFilter={statusFilter}
            onQueryChange={updateQuery}
            onStatusFilterChange={updateStatusFilter}
          />

          {categories.length === 0 ? (
            <EmptyServicesState onCreateCategory={() => setCategoryDialogOpen(true)} />
          ) : (
            <>
              <div className="space-y-6">
                {pagedCategories.map((category) => (
                  <ServicesCategorySection
                    key={category.id}
                    category={category}
                    pricingPending={pricingPending}
                    pricingCategoryId={pricingCategoryId}
                    onTogglePricingMode={handleToggleCategoryPricingMode}
                    onCreateService={openNewService}
                    onEditService={openEditService}
                    onArchiveCategory={handleArchiveCategory}
                    archivePending={archivePending}
                    archiveCategoryId={archiveCategoryId}
                  />
                ))}
              </div>
              {visibleCategories.length > CATEGORIES_PER_PAGE && (
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-700">
                      {Math.min((currentCategoryPage - 1) * CATEGORIES_PER_PAGE + 1, visibleCategories.length)}
                      -
                      {Math.min(currentCategoryPage * CATEGORIES_PER_PAGE, visibleCategories.length)}
                      {" de "}
                      {visibleCategories.length}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Pagina {currentCategoryPage} de {totalCategoryPages}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryPage((page) => Math.max(1, page - 1))}
                      disabled={currentCategoryPage === 1}
                      className="flex min-h-9 items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:border-neutral-100 disabled:bg-white disabled:text-neutral-300"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryPage((page) => Math.min(totalCategoryPages, page + 1))}
                      disabled={currentCategoryPage === totalCategoryPages}
                      className="flex min-h-9 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-neutral-100 disabled:bg-white disabled:text-neutral-300"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CategoryDialog
        open={categoryDialogOpen}
        pending={categoryPending}
        error={categoryError}
        onClose={() => setCategoryDialogOpen(false)}
        onSubmit={handleCreateCategory}
      />

      <ArchiveCategoryDialog
        category={categoryToArchive}
        pending={archivePending}
        error={archiveError}
        onClose={closeArchiveCategoryDialog}
        onConfirm={confirmArchiveCategory}
      />

      <NewServiceDialog
        open={serviceDialogOpen}
        categories={categories}
        defaultCategory={defaultCategory}
        pending={servicePending}
        error={serviceError}
        onClose={() => setServiceDialogOpen(false)}
        onSubmit={handleCreateService}
      />

      <EditServiceDialog
        service={editingService}
        categories={categories}
        pending={editPending}
        error={editError}
        onClose={closeEditService}
        onSubmit={handleUpdateService}
      />
    </div>
  );
}
