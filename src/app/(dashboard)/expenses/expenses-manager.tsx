"use client";

import { useEffect, useState } from "react";
import type { ExpensesPageView } from "@/features/expenses";
import type { InventoryProductOption } from "@/features/inventory";
import { ExpenseGeneralForm } from "./expense-general-form";
import { ExpensesCategoryBreakdown } from "./expenses-category-breakdown";
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
              ? "rounded-lg border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger-strong"
              : "rounded-lg border border-success-border bg-success-subtle px-4 py-3 text-sm text-success-fg"
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
      {activeTab === "history" && (
        <div className="space-y-6">
          <ExpensesCategoryBreakdown expenses={expenses} />
          <ExpensesHistory history={expenses.history} />
        </div>
      )}
    </div>
  );
}
