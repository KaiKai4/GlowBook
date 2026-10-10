"use client";

import { useMemo, useState, useTransition } from "react";
import {
  archiveCategoryAction,
  createCategoryAction,
  createServiceAction,
  updateCategoryPricingModeAction,
  updateServiceAction,
} from "./actions";
import {
  clampPage,
  filterCategories,
  getServicesTotals,
  getTotalCategoryPages,
  pageSlice,
} from "./services-manager-data";
import type { Category, ServiceItem, ServiceStatusFilter } from "./services-types";

/**
 * Estado y acciones de la pantalla de servicios. El componente solo pinta lo que
 * devuelve este hook; el filtrado y la paginación viven en `services-manager-data.ts`.
 */
export function useServicesManager(categories: Category[]) {
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
  const [pricingError, setPricingError] = useState<string | null>(null);

  const totals = useMemo(() => getServicesTotals(categories), [categories]);

  const visibleCategories = useMemo(
    () => filterCategories(categories, activeCategoryId, query, statusFilter),
    [categories, activeCategoryId, query, statusFilter],
  );

  const totalCategoryPages = getTotalCategoryPages(visibleCategories.length);
  const currentCategoryPage = clampPage(categoryPage, totalCategoryPages);
  const pagedCategories = useMemo(
    () => pageSlice(visibleCategories, currentCategoryPage),
    [currentCategoryPage, visibleCategories],
  );

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
    setPricingError(null);
    const nextMode = category.pricing_mode === "variable" ? "fixed" : "variable";

    startPricing(async () => {
      const result = await updateCategoryPricingModeAction(category.id, nextMode);
      if (!result.ok) setPricingError(result.error);
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

  return {
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
    categoryDialog: {
      open: categoryDialogOpen,
      openDialog: () => setCategoryDialogOpen(true),
      closeDialog: () => setCategoryDialogOpen(false),
      pending: categoryPending,
      error: categoryError,
      onSubmit: handleCreateCategory,
    },
    serviceDialog: {
      open: serviceDialogOpen,
      defaultCategory,
      closeDialog: () => setServiceDialogOpen(false),
      pending: servicePending,
      error: serviceError,
      onSubmit: handleCreateService,
    },
    editDialog: {
      service: editingService,
      pending: editPending,
      error: editError,
      close: closeEditService,
      onSubmit: handleUpdateService,
    },
    archiveDialog: {
      category: categoryToArchive,
      pending: archivePending,
      error: archiveError,
      close: closeArchiveCategoryDialog,
      confirm: confirmArchiveCategory,
    },
    pricing: {
      pending: pricingPending,
      pendingCategoryId: pricingCategoryId,
      error: pricingError,
      toggle: handleToggleCategoryPricingMode,
    },
    archivePending,
    archiveCategoryId,
    handleArchiveCategory,
    openNewService,
    openEditService,
  };
}
