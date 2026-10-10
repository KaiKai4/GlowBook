"use client";

import { useActionState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CommercialPlan,
  PlatformModule,
} from "@/features/billing/use-cases/commercial-plans";
import { savePlanAction, savePlanModulesAction } from "./actions";
import { PLATFORM_PLAN_IDLE_STATE } from "./action-state";
import {
  InlineState,
  MiniMetric,
  Panel,
  SaveAllButton,
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
      title={plan ? "Información del plan" : "Nuevo plan"}
      description={plan ? "Edita el contenedor comercial. Los límites se configuran en su propia pestaña." : "Crea el plan y luego configura módulos y límites."}
      compact={compact}
    >
      <form action={action} className="space-y-4">
        {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
        <Input name="name" label="Nombre del plan" placeholder="Plan Basico" defaultValue={plan?.name ?? ""} required />
        <Input name="code" label="Código interno" placeholder="Se genera desde el nombre" defaultValue={plan?.code ?? ""} />
        <Textarea name="description" label="Descripción" rows={compact ? 2 : 3} defaultValue={plan?.description ?? ""} />
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
        <p className="text-sm text-fg-subtle">Marca los apartados que el salón vera en la sidebar con este plan.</p>
        <SaveAllButton label="Guardar módulos" />
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

export { PlanLimits } from "./plan-limits";
export { PlanSummary } from "./plan-summary";
