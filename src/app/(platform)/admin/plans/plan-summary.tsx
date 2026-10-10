import { Layers3, ToggleLeft } from "lucide-react";

import type {
  CommercialLimitMetric,
  CommercialPlan,
  PlatformModule,
} from "@/features/billing";
import { countScopeLabel, modeLabel, Panel, StatusText } from "./workspace-ui";

export function PlanSummary({ plan, modules, metrics }: { plan: CommercialPlan; modules: PlatformModule[]; metrics: CommercialLimitMetric[] }) {
  const enabledModuleKeys = new Set(plan.modules.filter((module) => module.enabled).map((module) => module.moduleKey));
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const visibleLimits = plan.limits.filter((limit) => {
    const metric = metricByKey.get(limit.metricKey);
    return metric ? enabledModuleKeys.has(metric.moduleKey) : false;
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel icon={<Layers3 className="h-4 w-4" />} title="Módulos incluidos" description="Apartados que el salón vera en la sidebar.">
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map((module) => (
            <div key={module.key} className="flex items-center justify-between rounded-xl border border-brand-100 bg-surface px-3 py-2">
              <span className="text-sm font-semibold text-fg-secondary">{module.name}</span>
              <StatusText active={enabledModuleKeys.has(module.key)} activeText="Activo" inactiveText="Off" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon={<ToggleLeft className="h-4 w-4" />} title="Límites configurados" description="Topes y comportamiento al llegar al máximo.">
        <div className="space-y-2">
          {visibleLimits.length === 0 ? (
            <p className="text-sm text-fg-subtle">Este plan aún no tiene límites en sus módulos activos.</p>
          ) : (
            visibleLimits.map((limit) => {
              const metric = metricByKey.get(limit.metricKey);
              return (
                <div key={limit.metricKey} className="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg-strong">{metric?.name ?? limit.metricKey}</p>
                    <p className="mt-1 text-xs text-fg-subtle">
                      {countScopeLabel(limit.countScope)} · {modeLabel(limit.enforcementMode)}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-fg-muted">
                    {limit.maxValue === null ? "Sin límite" : `${limit.maxValue} ${metric?.unit ?? ""}`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}
