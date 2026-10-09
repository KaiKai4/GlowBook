"use client";

import { Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/dates";

export interface ChargedItem {
  id: string;
  price: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  isVariable: boolean;
  service: { name: string } | null;
}

type FieldValues = Record<string, string>;

export function ChargedItemsSection({
  chargedItems,
  itemPrices,
  itemDiscounts,
  setItemPrices,
  setItemDiscounts,
  subtotal,
  discountAmount,
  finalTotal,
}: {
  chargedItems: ChargedItem[];
  itemPrices: FieldValues;
  itemDiscounts: FieldValues;
  setItemPrices: (update: (current: FieldValues) => FieldValues) => void;
  setItemDiscounts: (update: (current: FieldValues) => FieldValues) => void;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        Servicios cobrados
      </p>

      <div className="space-y-2">
        {chargedItems.map((item) => (
          <div key={item.id} className="rounded-2xl border border-border bg-surface px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_216px] sm:items-end">
              <div className="min-w-0 self-start">
                <p className="truncate text-sm font-semibold text-fg-secondary">
                  {item.service?.name ?? "Servicio"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="block text-xs font-semibold uppercase text-fg-subtle">
                    Precio
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemPrices[item.id] ?? ""}
                    disabled={!item.isVariable}
                    onChange={(event) =>
                      setItemPrices((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className={cn(
                      "h-10 w-full rounded-xl border px-3 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500",
                      item.isVariable
                        ? "border-brand-200 bg-surface text-fg"
                        : "border-border bg-surface-muted text-fg-subtle"
                    )}
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-xs font-semibold uppercase text-fg-subtle">
                    Desc. %
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                    value={itemDiscounts[item.id] ?? ""}
                    onChange={(event) =>
                      setItemDiscounts((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-brand-200 bg-surface px-3 text-right text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </label>
              </div>
            </div>

            {item.discountAmount > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-success-subtle px-3 py-2 text-xs text-success-fg">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Tag className="h-3 w-3" />
                  Promocion aplicada solo a este servicio
                </span>
                <span>
                  -{formatCurrency(item.discountAmount)} = {formatCurrency(item.finalPrice)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm">
        <div className="flex items-center justify-between text-fg-muted">
          <span>Subtotal servicios</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="mt-1 flex items-center justify-between text-success-fg">
            <span>Descuentos por servicio</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold text-fg">
          <span>Total cobrado</span>
          <span>{formatCurrency(finalTotal)}</span>
        </div>
      </div>
    </div>
  );
}
