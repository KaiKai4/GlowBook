"use client";

import { ArchiveCategoryDialog } from "./archive-category-dialog";
import { CategoriesPagination } from "./categories-pagination";
import { CategoryDialog } from "./category-dialog";
import { EditServiceDialog } from "./edit-service-dialog";
import { EmptyServicesState } from "./empty-services-state";
import { NewServiceDialog } from "./new-service-dialog";
import { CATEGORIES_PER_PAGE } from "./services-manager-data";
import { ServicesCategorySection } from "./services-category-section";
import { ServicesFilters } from "./services-filters";
import { ServicesSidebar } from "./services-sidebar";
import { ServicesStats } from "./services-stats";
import type { Category } from "./services-types";
import { useServicesManager } from "./use-services-manager";

export function ServicesManager({ categories }: { categories: Category[] }) {
  const manager = useServicesManager(categories);
  const {
    totals,
    activeCategoryId,
    query,
    statusFilter,
    visibleCategories,
    totalCategoryPages,
    currentCategoryPage,
    pagedCategories,
    setCategoryPage,
    selectCategory,
    updateQuery,
    updateStatusFilter,
    categoryDialog,
    serviceDialog,
    editDialog,
    archiveDialog,
    pricing,
    archivePending,
    archiveCategoryId,
    handleArchiveCategory,
    openNewService,
    openEditService,
  } = manager;

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
          onCreateCategory={categoryDialog.openDialog}
        />

        <div className="flex min-h-[calc(100vh-208px)] flex-col space-y-6">
          <ServicesFilters
            query={query}
            statusFilter={statusFilter}
            onQueryChange={updateQuery}
            onStatusFilterChange={updateStatusFilter}
          />

          {pricing.error ? (
            <p role="alert" className="rounded-lg border border-danger-border-subtle bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
              {pricing.error}
            </p>
          ) : null}

          {categories.length === 0 ? (
            <EmptyServicesState onCreateCategory={categoryDialog.openDialog} />
          ) : (
            <>
              <div className="space-y-6">
                {pagedCategories.map((category) => (
                  <ServicesCategorySection
                    key={category.id}
                    category={category}
                    pricingPending={pricing.pending}
                    pricingCategoryId={pricing.pendingCategoryId}
                    onTogglePricingMode={pricing.toggle}
                    onCreateService={openNewService}
                    onEditService={openEditService}
                    onArchiveCategory={handleArchiveCategory}
                    archivePending={archivePending}
                    archiveCategoryId={archiveCategoryId}
                  />
                ))}
              </div>
              {visibleCategories.length > CATEGORIES_PER_PAGE && (
                <CategoriesPagination
                  page={currentCategoryPage}
                  totalPages={totalCategoryPages}
                  pageSize={CATEGORIES_PER_PAGE}
                  total={visibleCategories.length}
                  onPageChange={setCategoryPage}
                />
              )}
            </>
          )}
        </div>
      </div>

      <CategoryDialog
        open={categoryDialog.open}
        pending={categoryDialog.pending}
        error={categoryDialog.error}
        onClose={categoryDialog.closeDialog}
        onSubmit={categoryDialog.onSubmit}
      />

      <ArchiveCategoryDialog
        category={archiveDialog.category}
        pending={archiveDialog.pending}
        error={archiveDialog.error}
        onClose={archiveDialog.close}
        onConfirm={archiveDialog.confirm}
      />

      <NewServiceDialog
        open={serviceDialog.open}
        categories={categories}
        defaultCategory={serviceDialog.defaultCategory}
        pending={serviceDialog.pending}
        error={serviceDialog.error}
        onClose={serviceDialog.closeDialog}
        onSubmit={serviceDialog.onSubmit}
      />

      <EditServiceDialog
        service={editDialog.service}
        categories={categories}
        pending={editDialog.pending}
        error={editDialog.error}
        onClose={editDialog.close}
        onSubmit={editDialog.onSubmit}
      />
    </div>
  );
}
