"use client";

import { Building2, Gauge, ShieldAlert } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/components/ui/cn";
import type { SalonSubscriptionDetail } from "@/features/billing";
import type { SalonSubscriptionRow } from "@/features/billing/domain/salon-subscription-rows";
import type { SubscriptionsPageData } from "@/features/billing";
import { useSalonWorkspaceTab } from "./use-salon-workspace-tab";
import { STATUS_LABELS } from "./salon-workspace-format";
import { SummaryTab } from "./salon-workspace-summary";
import { ActionsTab, UsageTab } from "./salon-workspace-tabs";
import type { SalonTab, SalonWorkspaceSalon } from "./salon-workspace-types";

const SALON_TABS: Array<{ key: SalonTab; label: string; icon: React.ReactNode }> = [
  { key: "summary", label: "Resumen", icon: <Building2 className="h-4 w-4" /> },
  { key: "usage", label: "Plan y uso", icon: <Gauge className="h-4 w-4" /> },
  { key: "actions", label: "Acciones", icon: <ShieldAlert className="h-4 w-4" /> },
];

export function SalonWorkspace({
  salon,
  row,
  detail,
  modules,
}: {
  salon: SalonWorkspaceSalon;
  row: SalonSubscriptionRow | null;
  detail: SalonSubscriptionDetail;
  modules: SubscriptionsPageData["modules"];
}) {
  const { tab, setTab, warningCount } = useSalonWorkspaceTab(detail);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold text-fg-strong">{salon.name}</h2>
            <StatusBadge
              variant={salon.isActive ? "success" : "danger"}
              label={salon.isActive ? "Activo" : "Suspendido"}
            />
          </div>
          <p className="mt-1 text-sm text-fg-subtle">
            {row?.planName
              ? `${row.planName} · ${STATUS_LABELS[row.status ?? ""] ?? "Sin estado"} · ${row.currency} ${row.monthlyTotal.toFixed(2)}/mes`
              : "Sin plan asignado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SALON_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                tab === item.key
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-brand-100 bg-surface text-fg-muted hover:border-brand-200 hover:text-brand-700"
              )}
            >
              {item.icon}
              {item.label}
              {item.key === "usage" && warningCount > 0 ? (
                <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs text-warning-strong">{warningCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "summary" ? <SummaryTab salon={salon} row={row} detail={detail} /> : null}
        {tab === "usage" ? <UsageTab detail={detail} row={row} modules={modules} salonId={salon.id} /> : null}
        {tab === "actions" ? <ActionsTab salon={salon} /> : null}
      </div>
    </section>
  );
}
