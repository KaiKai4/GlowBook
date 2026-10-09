"use client";

import { cn } from "@/lib/utils/cn";

export type InventoryTab = "transfer" | "product" | "products" | "movements";

const TABS: Array<{ value: InventoryTab; label: string }> = [
  { value: "products", label: "Productos" },
  { value: "transfer", label: "Transferir stock" },
  { value: "product", label: "Nuevo producto" },
  { value: "movements", label: "Movimientos" },
];

export function InventoryTabs({
  activeTab,
  onChange,
}: {
  activeTab: InventoryTab;
  onChange: (tab: InventoryTab) => void;
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
