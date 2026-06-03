"use client";

import { useState } from "react";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { RetailProductList } from "./retail-product-list";
import { RetailSaleForm } from "./retail-sale-form";
import { RetailSalesHistory } from "./retail-sales-history";
import { RetailStats } from "./retail-stats";
import { RetailTabs, type RetailTab } from "./retail-tabs";

export function RetailManager({ retail }: { retail: RetailPageView }) {
  const [activeTab, setActiveTab] = useState<RetailTab>("sales");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleResult(result: { ok: boolean; message: string }) {
    setMessage(result.ok ? result.message : null);
    setError(result.ok ? null : result.message);
  }

  function handleTabChange(tab: RetailTab) {
    setActiveTab(tab);
    setMessage(null);
    setError(null);
  }

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

      <RetailStats retail={retail} />
      <RetailTabs activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === "sales" && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <RetailSaleForm retail={retail} onResult={handleResult} />
          <RetailSalesHistory sales={retail.recentSales} />
        </div>
      )}

      {activeTab === "products" && <RetailProductList products={retail.products} />}
    </div>
  );
}
