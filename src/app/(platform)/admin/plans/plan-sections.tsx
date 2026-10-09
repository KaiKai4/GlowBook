"use client";

import { useActionState } from "react";
import { Layers3, Plus, SlidersHorizontal, ToggleLeft } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  PlatformModule,
} from "@/features/billing/use-cases/commercial-plans";
import { savePlanAction, savePlanLimitsAction, savePlanModulesAction } from "./actions";
import { PLATFORM_PLAN_IDLE_STATE } from "./action-state";
import {
  countScopeLabel,
  InlineState,
  MiniMetric,
  modeLabel,
  Panel,
  SaveAllButton,
  StatusText,
  statusLabel,
  SubmitButton,
  ToggleRow,
} from "./workspace-ui";

export function PlanInfoEditor({ plan, assignedSalons }: { plan: CommercialPlan; assignedSalons: number }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniMetric label="Precio" value={`${plan.currency} ${plan.monthlyPrice.toFixed(2)}`} />
        <MiniMetric label="Trial" value={`${plan.trialDays} días`} />
        <MiniMetric label="Estado" value={statusLabel(plan.status)} />
        <MiniMetric label="Salones" value={String(assignedSalons)} />
      </div>
      <PlanForm plan={plan} compact />
    </div>
  );
}

export function PlanForm({ plan, compact = false }: { plan: CommercialPlan | null; compact?: boolean }) {
  const [state, action] = useActionState(savePlanAction, PLATFORM_PLAN_IDLE_STATE);

  return (
    <Panel
      icon={<Plus className="h-4 w-4" />}
      title={plan ? "Informacion del plan" : "Nuevo plan"}
      description={plan ? "Edita el contenedor comercial. Los límites se configuran en su propia pestaña." : "Crea el plan y luego configura modulos y límites."}
      compact={compact}
    >
      <form action={action} className="space-y-4">
        {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
        <Input name="name" label="Nombre del plan" placeholder="Plan Basico" defaultValue={plan?.name ?? ""} required />
        <Input name="code" label="Codigo interno" placeholder="Se genera desde el nombre" defaultValue={plan?.code ?? ""} />
        <Textarea name="description" label="Descripcion" rows={compact ? 2 : 3} defaultValue={plan?.description ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input name="monthlyPrice" label="Precio mensual" type="number" min="0" step="0.01" defaultValue={plan?.monthlyPrice ?? 0} />
          <Input name="trialDays" label="Trial días" type="number" min="0" defaultValue={plan?.trialDays ?? 0} />
          <Input name="currency" label="Moneda" maxLength={3} defaultValue={plan?.currency ?? "USD"} />
          <Input name="sortOrder" label="Orden" type="number" defaultValue={plan?.sortOrder ?? 0} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select name="status" label="Estado" defaultValue={plan?.status ?? "draft"}>
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </Select>
          <ToggleRow name="isPublic" label="Visible comercialmente" defaultChecked={plan?.isPublic ?? false} />
          <div className="flex items-end">
            <SubmitButton label={plan ? "Guardar cambios" : "Crear plan"} />
          </div>
        </div>
        <InlineState state={state} block />
      </form>
    </Panel>
  );
}

export function PlanModules({ plan, modules }: { plan: CommercialPlan; modules: PlatformModule[] }) {
  const [state, action] = useActionState(savePlanModulesAction, PLATFORM_PLAN_IDLE_STATE);
  const moduleByKey = new Map(plan.modules.map((module) => [module.moduleKey, module]));
  const visibleModules = modules.filter((module) => !module.isArchived);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="planId" value={plan.id} />
      {visibleModules.map((module) => (
        <input key={module.key} type="hidden" name="allModuleKeys" value={module.key} />
      ))}

      <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-1 flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-surface/95 px-5 py-3 backdrop-blur">
        <p className="text-sm text-fg-subtle">Marca los apartados que el salon vera en la sidebar con este plan.</p>
        <SaveAllButton label="Guardar modulos" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visibleModules.map((module) => (
          <PlanModuleCard
            key={module.key}
            module={module}
            defaultEnabled={moduleByKey.get(module.key)?.enabled ?? false}
          />
        ))}
      </div>

      <InlineState state={state} block />
    </form>
  );
}

function PlanModuleCard({ module, defaultEnabled }: { module: PlatformModule; defaultEnabled: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-100 bg-surface p-4 transition hover:border-brand-200 hover:bg-brand-50/20 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/40">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
        <SlidersHorizontal className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg-strong">{module.name}</p>
        <p className="mt-1 line-clamp-1 text-sm text-fg-subtle">{module.description}</p>
      </div>
      <input
        name="enabledModuleKeys"
        value={module.key}
        type="checkbox"
        defaultChecked={defaultEnabled}
        className="h-5 w-5 shrink-0 rounded border-border-strong text-brand-600 focus:ring-brand-500"
      />
    </label>
  );
}

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

export function PlanSummary({ plan, modules, metrics }: { plan: CommercialPlan; modules: PlatformModule[]; metrics: CommercialLimitMetric[] }) {
  const enabledModuleKeys = new Set(plan.modules.filter((module) => module.enabled).map((module) => module.moduleKey));
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const visibleLimits = plan.limits.filter((limit) => {
    const metric = metricByKey.get(limit.metricKey);
    return metric ? enabledModuleKeys.has(metric.moduleKey) : false;
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel icon={<Layers3 className="h-4 w-4" />} title="Modulos incluidos" description="Apartados que el salon vera en la sidebar.">
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map((module) => (
            <div key={module.key} className="flex items-center justify-between rounded-xl border border-brand-100 bg-surface px-3 py-2">
              <span className="text-sm font-semibold text-fg-secondary">{module.name}</span>
              <StatusText active={enabledModuleKeys.has(module.key)} activeText="Activo" inactiveText="Off" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon={<ToggleLeft className="h-4 w-4" />} title="Límites configurados" description="Topes y comportamiento al llegar al maximo.">
        <div className="space-y-2">
          {visibleLimits.length === 0 ? (
            <p className="text-sm text-fg-subtle">Este plan aun no tiene límites en sus modulos activos.</p>
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

function groupMetrics(metrics: CommercialLimitMetric[]) {
  const groups = new Map<string, CommercialLimitMetric[]>();
  for (const metric of metrics.filter((item) => !item.isArchived)) {
    groups.set(metric.moduleKey, [...(groups.get(metric.moduleKey) ?? []), metric]);
  }
  return Array.from(groups.entries());
}
