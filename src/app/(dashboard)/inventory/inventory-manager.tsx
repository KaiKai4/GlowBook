"use client";

import { useEffect, useState, useTransition } from "react";
import type { InventoryPageView } from "@/features/inventory/use-cases/inventory-products";
import {
  createInventoryProductAction,
  deleteInventoryProductAction,
  transferInventoryStockAction,
  updateInventoryProductAction,
} from "./actions";
import { InventoryMovementsList } from "./inventory-movements-list";
import { InventoryProductList } from "./inventory-product-list";
import { InventoryStats } from "./inventory-stats";
import { InventoryTabs, type InventoryTab } from "./inventory-tabs";
import { NewProductForm } from "./new-product-form";
import { TransferStockForm } from "./transfer-stock-form";

type FormKind = "product" | "transfer" | `edit:${string}` | `delete:${string}`;

export function InventoryManager({ inventory }: { inventory: InventoryPageView }) {
  const [activeTab, setActiveTab] = useState<InventoryTab>("products");
  const [pendingForm, setPendingForm] = useState<FormKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(kind: FormKind, action: () => Promise<{ ok: boolean; error?: string; value?: unknown }>) {
    setPendingForm(kind);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage(typeof result.value === "string" ? result.value : "Cambios guardados.");
      } else {
        setError(result.error ?? "No se pudo guardar.");
      }
      setPendingForm(null);
    });
  }

  function changeTab(tab: InventoryTab) {
    setActiveTab(tab);
    setMessage(null);
    setError(null);
  }

  function handleCreateProduct(formData: FormData) {
    run("product", () => createInventoryProductAction(null, formData));
  }

  function handleTransfer(formData: FormData) {
    run("transfer", () => transferInventoryStockAction(null, formData));
  }

  function handleSaveProduct(productId: string, formData: FormData) {
    run(`edit:${productId}`, () => updateInventoryProductAction(productId, null, formData));
  }

  function handleDeleteProduct(productId: string) {
    run(`delete:${productId}`, () => deleteInventoryProductAction(productId));
  }

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div
          className={
            error
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          }
        >
          {error ?? message}
        </div>
      )}

      <InventoryStats inventory={inventory} />
      <InventoryTabs activeTab={activeTab} onChange={changeTab} />

      {activeTab === "products" && (
        <InventoryProductList
          products={inventory.products}
          pendingForm={pendingForm}
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
        />
      )}

      {activeTab === "transfer" && (
        <TransferStockForm
          products={inventory.products}
          pending={pendingForm === "transfer"}
          onTransfer={handleTransfer}
        />
      )}

      {activeTab === "product" && (
        <NewProductForm pending={pendingForm === "product"} onCreate={handleCreateProduct} />
      )}

      {activeTab === "movements" && <InventoryMovementsList movements={inventory.recentMovements} />}
    </div>
  );
}
