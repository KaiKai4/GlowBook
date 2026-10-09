"use client";

import { useState } from "react";
import { Archive, Layers3, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  PlatformModule,
} from "@/features/billing/use-cases/commercial-plans";
import { cn } from "@/lib/utils/cn";
import { removePlanAction } from "./actions";
import { PlanForm, PlanInfoEditor, PlanLimits, PlanModules, PlanSummary } from "./plan-sections";
import { EmptyState, StatusPill } from "./workspace-ui";

type PlanEditorTab = "info" | "modules" | "limits" | "summary";

interface PlansWorkspaceData {
  modules: PlatformModule[];
  metrics: CommercialLimitMetric[];
  plans: CommercialPlan[];
  assignmentsByPlan: Record<string, number>;
}

const PLAN_TABS: Array<{ key: PlanEditorTab; label: string }> = [
  { key: "info", label: "Informacion" },
  { key: "modules", label: "Modulos" },
  { key: "limits", label: "Límites" },
  { key: "summary", label: "Resumen" },
];

export function PlansWorkspace({
  data,
  startInCreateMode = false,
}: {
  data: PlansWorkspaceData;
  startInCreateMode?: boolean;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(startInCreateMode ? "__new" : data.plans[0]?.id ?? "__new");
  const [editorTab, setEditorTab] = useState<PlanEditorTab>("info");
  const isCreateMode = selectedPlanId === "__new";
  const selectedPlan = isCreateMode ? null : data.plans.find((plan) => plan.id === selectedPlanId) ?? data.plans[0] ?? null;
  const selectedAssignments = selectedPlan ? data.assignmentsByPlan[selectedPlan.id] ?? 0 : 0;
  const visibleLimitsCount = selectedPlan ? countVisibleLimits(selectedPlan, data.metrics) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-soft">
      <div className="grid h-[calc(100vh-210px)] min-h-[540px] lg:grid-cols-[300px_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-brand-100 bg-surface-muted/60 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Planes</p>
              <p className="mt-1 text-sm text-fg-subtle">{data.plans.length} registrados</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {data.plans.filter((plan) => plan.status === "active").length} activos
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            <button
              id="new-plan"
              type="button"
              onClick={() => {
                setSelectedPlanId("__new");
                setEditorTab("info");
              }}
              className={cn(
                "mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
                isCreateMode
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-brand-100 bg-surface text-fg-secondary hover:border-brand-300 hover:text-brand-700"
              )}
            >
              <Plus className="h-4 w-4" />
              Nuevo plan
            </button>

            {data.plans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-brand-200 bg-surface px-4 py-8 text-center text-sm text-fg-subtle">
                Crea el primer plan para comenzar.
              </div>
            ) : (
              data.plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setEditorTab("info");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                    selectedPlan?.id === plan.id
                      ? "border-brand-300 bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-600)]"
                      : "border-transparent hover:border-brand-100 hover:bg-surface"
                  )}
                >
                  <span className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    selectedPlan?.id === plan.id
                      ? "border-brand-200 bg-surface text-brand-700"
                      : "border-border bg-surface text-fg-subtle"
                  )}>
                    <Layers3 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg-strong">{plan.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">
                      {plan.currency} {plan.monthlyPrice.toFixed(2)}/mes · {data.assignmentsByPlan[plan.id] ?? 0} salones
                    </span>
                  </span>
                  <StatusPill status={plan.status} />
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-surface">
          {selectedPlan ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-100 px-5 py-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-700">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-semibold text-fg-strong">{selectedPlan.name}</h2>
                      <span className="rounded-lg bg-surface-sunken px-2 py-1 font-mono text-xs text-fg-muted">
                        {selectedPlan.code}
                      </span>
                      {selectedAssignments > 0 ? (
                        <span className="rounded-lg bg-warning-subtle px-2 py-1 text-xs font-semibold text-warning-fg">
                          {selectedAssignments} {selectedAssignments === 1 ? "salon asignado" : "salones asignados"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-fg-subtle">
                      {selectedPlan.description || "Configura informacion, modulos y límites de este plan."}
                    </p>
                  </div>
                </div>
                <form action={removePlanAction.bind(null, selectedPlan, selectedAssignments > 0)}>
                  <Button type="submit" variant="outline" className="border-danger-border text-danger hover:bg-danger-subtle">
                    <Archive className="h-4 w-4" />
                    {selectedAssignments > 0 ? "Archivar" : "Eliminar"}
                  </Button>
                </form>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-brand-100 px-5 pt-3">
                {PLAN_TABS.map((tab) => (
                  <PlanTab
                    key={tab.key}
                    active={editorTab === tab.key}
                    onClick={() => setEditorTab(tab.key)}
                    count={tab.key === "modules" ? selectedPlan.modules.filter((module) => module.enabled).length : tab.key === "limits" ? visibleLimitsCount : undefined}
                  >
                    {tab.label}
                  </PlanTab>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {editorTab === "info" ? <PlanInfoEditor plan={selectedPlan} assignedSalons={selectedAssignments} /> : null}
                {editorTab === "modules" ? <PlanModules plan={selectedPlan} modules={data.modules} /> : null}
                {editorTab === "limits" ? <PlanLimits plan={selectedPlan} metrics={data.metrics} modules={data.modules} /> : null}
                {editorTab === "summary" ? <PlanSummary plan={selectedPlan} modules={data.modules} metrics={data.metrics} /> : null}
              </div>
            </>
          ) : isCreateMode ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <PlanForm plan={null} />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState title="Selecciona un plan" description="Elige un plan de la lista o crea uno nuevo para configurarlo." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function countVisibleLimits(plan: CommercialPlan, metrics: CommercialLimitMetric[]) {
  const enabledModuleKeys = new Set(
    plan.modules.filter((module) => module.enabled).map((module) => module.moduleKey)
  );
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  return plan.limits.filter((limit) => {
    const metric = metricByKey.get(limit.metricKey);
    return metric ? enabledModuleKeys.has(metric.moduleKey) : false;
  }).length;
}

function PlanTab({ active, onClick, count, children }: { active: boolean; onClick: () => void; count?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 border-b-2 px-4 text-sm font-semibold transition-colors",
        active ? "border-brand-600 text-brand-700" : "border-transparent text-fg-subtle hover:text-fg"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {children}
        {typeof count === "number" ? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{count}</span>
        ) : null}
      </span>
    </button>
  );
}
