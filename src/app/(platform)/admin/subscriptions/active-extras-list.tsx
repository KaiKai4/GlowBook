"use client";

import { Gift, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SalonExtraView } from "@/features/billing";
import { Panel } from "../plans/workspace-ui";
import { cancelExtraAction } from "./actions";

export function ActiveExtrasList({ salonId, extras }: { salonId: string; extras: SalonExtraView[] }) {
  return (
    <Panel
      icon={<Gift className="h-4 w-4" />}
      title="Extras vigentes"
      description="Módulos y aumentos de límite activos para este salón, vendidos o regalados."
    >
      {extras.length === 0 ? (
        <p className="text-sm text-fg-subtle">Este salón no tiene extras vigentes.</p>
      ) : (
        <div className="space-y-2">
          {extras.map((extra) => (
            <div
              key={extra.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-surface px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-fg-strong">
                    {extra.name}
                    {extra.quantity > 1 ? ` × ${extra.quantity}` : ""}
                  </p>
                  {extra.isGift ? (
                    <span className="rounded-lg bg-accent-subtle px-2 py-0.5 text-xs font-semibold text-accent-strong">Regalo</span>
                  ) : (
                    <span className="rounded-lg bg-success-subtle px-2 py-0.5 text-xs font-semibold text-success-fg">
                      USD {extra.monthlyPrice.toFixed(2)}/mes
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-fg-subtle">
                  {extra.detail}
                  {extra.endsAt ? ` · vence ${extra.endsAt}` : ""}
                  {extra.reason ? ` · ${extra.reason}` : ""}
                </p>
              </div>
              <form action={cancelExtraAction.bind(null, extra.id, salonId)}>
                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  className="border-danger-border text-danger hover:bg-danger-subtle"
                  aria-label={`Cancelar ${extra.name}`}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
