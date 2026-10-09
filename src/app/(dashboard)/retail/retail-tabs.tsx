"use client";

import { cn } from "@/lib/utils/cn";

export type RetailTab = "sales" | "products";

const TABS: Array<{ value: RetailTab; label: string }> = [
  { value: "sales", label: "Ventas" },
  { value: "products", label: "Productos disponibles" },
];

export function RetailTabs({
  activeTab,
  onChange,
}: {
  activeTab: RetailTab;
  onChange: (tab: RetailTab) => void;
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
                : "text-fg-subtle hover:bg-surface-muted hover:text-fg"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
