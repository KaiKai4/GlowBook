"use client";

import { AlertTriangle, ArrowRight, Blocks, Check, Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  SalonSubscriptionDetail,
  SubscriptionsPageData,
} from "@/features/billing/use-cases/salon-subscriptions";
import { cn } from "@/lib/utils/cn";
import { countScopeLabel, Panel, StatusText } from "../plans/workspace-ui";
import { resolveAlertAction } from "./actions";

export function UsagePanel({
  detail,
  modules,
  onExpandLimit,
}: {
  detail: SalonSubscriptionDetail;
  modules: SubscriptionsPageData["modules"];
  /** Abre el flujo de extras con este límite preseleccionado. */
  onExpandLimit?: (metricKey: string) => void;
}) {
  if (!detail.plan) {
    return (
      <p className="rounded-xl border border-dashed border-brand-200 bg-surface px-4 py-8 text-center text-sm text-fg-subtle">
        Asigna un plan para ver el consumo de límites de este salon.
      </p>
    );
  }

  const enabledModules = new Set(detail.enabledModules);

  return (
    <div className="space-y-5">
      {detail.openAlerts.length > 0 ? (
        <Panel
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Alertas abiertas"
          description="Avisos generados por límites alcanzados o cercanos. Resuelvelas cuando ya las atendiste."
        >
          <div className="divide-y divide-brand-100">
            {detail.openAlerts.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      alert.severity === "danger" ? "bg-danger" : alert.severity === "warning" ? "bg-warning" : "bg-info"
                    )}
                  />
                  <p className="min-w-0 text-sm text-fg-secondary">{alert.message}</p>
                </div>
                <form action={resolveAlertAction.bind(null, alert.id, detail.salonId)}>
                  <Button type="submit" variant="outline" size="sm">
                    <Check className="h-3.5 w-3.5" />
                    Resuelta
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel
        icon={<Gauge className="h-4 w-4" />}
        title="Consumo de límites"
        description="Que tanto del plan asignado (mas extras) esta usando este salon."
      >
        {detail.limits.length === 0 ? (
          <p className="text-sm text-fg-subtle">El plan no tiene límites configurados.</p>
        ) : (
          <div className="space-y-4">
            {detail.limits.map((limit) => (
              <UsageBar key={limit.metric.key} limit={limit} onExpandLimit={onExpandLimit} />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        icon={<Blocks className="h-4 w-4" />}
        title="Modulos visibles"
        description="Apartados de la sidebar que este salon puede usar segun plan y extras."
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <div key={module.key} className="flex items-center justify-between rounded-xl border border-brand-100 bg-surface px-3 py-2">
              <span className="text-sm font-semibold text-fg-secondary">{module.name}</span>
              <StatusText active={enabledModules.has(module.key)} activeText="Activo" inactiveText="Off" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function UsageBar({
  limit,
  onExpandLimit,
}: {
  limit: SalonSubscriptionDetail["limits"][number];
  onExpandLimit?: (metricKey: string) => void;
}) {
  const percentage = limit.percentage;
  const width = percentage === null ? 0 : Math.min(100, percentage);
  const tone =
    limit.warningLevel === "blocked" || limit.warningLevel === "over_limit"
      ? "danger"
      : limit.warningLevel === "near_limit"
        ? "warning"
        : "ok";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-fg">{limit.metric.name}</p>
          <span className="text-xs text-fg-subtle">{countScopeLabel(limit.countScope)}</span>
        </div>
        <p className="text-sm text-fg-muted">
          <span className={cn(
            "font-semibold",
            tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning-fg" : "text-fg"
          )}>
            {limit.used}
          </span>
          {limit.maxValue === null ? (
            <span className="text-fg-subtle"> / sin límite</span>
          ) : (
            <span className="text-fg-subtle"> / {limit.maxValue} {limit.metric.unit}</span>
          )}
          {percentage !== null ? <span className="ml-2 text-xs text-fg-subtle">({percentage}%)</span> : null}
        </p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-sunken">
        {limit.maxValue === null ? (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,theme(colors.stone.200),theme(colors.stone.200)_6px,transparent_6px,transparent_12px)]" />
        ) : (
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-brand-500"
            )}
            style={{ width: `${width}%` }}
          />
        )}
      </div>
      {limit.message ? (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className={cn(
            "text-xs font-medium",
            tone === "danger" ? "text-danger" : "text-warning-fg"
          )}>
            {limit.message}
          </p>
          {onExpandLimit ? (
            <button
              type="button"
              onClick={() => onExpandLimit(limit.metric.key)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              Ampliar límite con un extra
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
