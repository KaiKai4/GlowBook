"use client";

import { cn } from "@/components/ui/cn";

export type ExpensesTab = "history" | "new" | "inventory_purchase";

const TABS: Array<{ value: ExpensesTab; label: string }> = [
  { value: "history", label: "Historial" },
  { value: "new", label: "Nuevo gasto" },
  { value: "inventory_purchase", label: "Compra de inventario" },
];

export function ExpensesTabs({
  activeTab,
  onChange,
}: {
  activeTab: ExpensesTab;
  onChange: (tab: ExpensesTab) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface p-1">
      <div className="flex min-w-max gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "h-10 rounded-lg px-4 text-sm font-semibold transition-colors",
              activeTab === tab.value
                ? "bg-brand-600 text-surface shadow-sm"
                : "text-fg-secondary hover:bg-surface-muted hover:text-fg"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
