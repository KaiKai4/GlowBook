"use client";

import { useEffect, useState } from "react";
import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import type { InventoryProductOption } from "@/features/inventory/use-cases/inventory-product-options";
import { ExpenseGeneralForm } from "./expense-general-form";
import { ExpensesHistory } from "./expenses-history";
import { ExpensesStats } from "./expenses-stats";
import { ExpensesTabs, type ExpensesTab } from "./expenses-tabs";
import { InventoryPurchaseExpenseForm } from "./inventory-purchase-expense-form";

export function ExpensesManager({
  expenses,
  inventoryProducts,
  canManageInventory,
}: {
  expenses: ExpensesPageView;
  inventoryProducts: InventoryProductOption[];
  canManageInventory: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ExpensesTab>("history");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  function changeTab(tab: ExpensesTab) {
    setActiveTab(tab);
    setMessage(null);
    setError(null);
  }

  function handleResult(result: { ok: boolean; message: string }) {
    if (result.ok) {
      setMessage(result.message);
      setError(null);
      setActiveTab("history");
    } else {
      setMessage(null);
      setError(result.message);
    }
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

      <ExpensesStats expenses={expenses} />
      <ExpensesTabs activeTab={activeTab} onChange={changeTab} />

      {activeTab === "new" && <ExpenseGeneralForm onResult={handleResult} />}
      {activeTab === "inventory_purchase" && (
        <InventoryPurchaseExpenseForm
          inventoryProducts={inventoryProducts}
          canManageInventory={canManageInventory}
          onResult={handleResult}
        />
      )}
      {activeTab === "history" && <ExpensesHistory history={expenses.history} />}
    </div>
  );
}
