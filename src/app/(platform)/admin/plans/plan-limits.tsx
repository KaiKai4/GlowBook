"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  PlatformModule,
} from "@/features/billing/use-cases/commercial-plans";
import { savePlanLimitsAction } from "./actions";
import { PLATFORM_PLAN_IDLE_STATE } from "./action-state";
import { InlineState, SaveAllButton } from "./workspace-ui";

export function PlanLimits({ plan, metrics, modules }: { plan: CommercialPlan; metrics: CommercialLimitMetric[]; modules: PlatformModule[] }) {
  const [state, action] = useActionState(savePlanLimitsAction, PLATFORM_PLAN_IDLE_STATE);
  const moduleByKey = new Map(modules.map((module) => [module.key, module]));
  const limitByMetric = new Map(plan.limits.map((limit) => [limit.metricKey, limit]));
  // Solo se configuran límites de modulos incluidos en el plan: un límite de
  // un modulo apagado no controla nada.
  const enabledModuleKeys = new Set(
    plan.modules.filter((module) => module.enabled).map((module) => module.moduleKey)
  );
  const visibleMetrics = metrics.filter((metric) => enabledModuleKeys.has(metric.moduleKey));
  const hiddenModuleNames = Array.from(
    new Set(
      metrics
        .filter((metric) => !enabledModuleKeys.has(metric.moduleKey))
        .map((metric) => moduleByKey.get(metric.moduleKey)?.name ?? metric.moduleKey)
    )
  );

  if (visibleMetrics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-surface px-4 py-10 text-center text-sm text-fg-subtle">
        Este plan no tiene modulos activos. Activa modulos en la pestaña Modulos y aqui apareceran sus límites.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="planId" value={plan.id} />

      <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-1 flex justify-end border-b border-brand-100 bg-surface/95 px-5 py-3 backdrop-blur">
        <SaveAllButton label="Guardar límites" />
      </div>

      {groupMetrics(visibleMetrics).map(([moduleKey, group]) => (
        <section key={moduleKey} className="overflow-hidden rounded-xl border border-brand-100 bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/30 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Límites</p>
              <h3 className="mt-1 font-semibold text-fg-strong">{moduleByKey.get(moduleKey as PlatformModule["key"])?.name ?? moduleKey}</h3>
            </div>
            <span className="rounded-lg bg-surface px-3 py-1 text-xs font-semibold text-brand-700">{group.length} controles</span>
          </div>
          <div className="divide-y divide-brand-100">
            {group.map((metric) => (
              <PlanLimitRow key={metric.key} metric={metric} limit={limitByMetric.get(metric.key)} />
            ))}
          </div>
        </section>
      ))}

      {hiddenModuleNames.length > 0 ? (
        <p className="text-xs leading-5 text-fg-subtle">
          Modulos sin límites configurables porque no estan incluidos en este plan: {hiddenModuleNames.join(", ")}.
          Activalos en la pestaña Modulos para configurar sus límites.
        </p>
      ) : null}
      <InlineState state={state} block />
    </form>
  );
}

function PlanLimitRow({
  metric,
  limit,
}: {
  metric: CommercialLimitMetric;
  limit?: CommercialPlan["limits"][number];
}) {
  return (
    <div className="grid gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_150px_190px_170px_120px] xl:items-end">
      <input type="hidden" name="metricKey" value={metric.key} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-fg-strong">{metric.name}</p>
          <span className="rounded-lg bg-surface-sunken px-2 py-1 font-mono text-xs text-fg-muted">{metric.key}</span>
        </div>
        <p className="mt-2 text-sm text-fg-subtle">{metric.description}</p>
      </div>
      <Input name="maxValue" label={`Maximo (${metric.unit || "total"})`} type="number" min="0" defaultValue={limit?.maxValue ?? ""} placeholder="Sin límite" />
      <Select name="countScope" label="Tipo de conteo" defaultValue={limit?.countScope ?? metric.defaultCountScope}>
        <option value="current">Actual</option>
        <option value="billing_cycle">Ciclo de facturacion</option>
        <option value="monthly">Mes calendario</option>
        <option value="lifetime">Historico total</option>
      </Select>
      <Select name="enforcementMode" label="Al llegar al límite" defaultValue={limit?.enforcementMode ?? "warn"}>
        <option value="none">Sin control</option>
        <option value="warn">Advertencia</option>
        <option value="block">Bloqueo</option>
      </Select>
      <Input name="warningThreshold" label="Avisar al %" type="number" min="1" max="100" defaultValue={limit?.warningThreshold ?? 80} />
    </div>
  );
}

function groupMetrics(metrics: CommercialLimitMetric[]) {
  const groups = new Map<string, CommercialLimitMetric[]>();
  for (const metric of metrics.filter((item) => !item.isArchived)) {
    groups.set(metric.moduleKey, [...(groups.get(metric.moduleKey) ?? []), metric]);
  }
  return Array.from(groups.entries());
}
