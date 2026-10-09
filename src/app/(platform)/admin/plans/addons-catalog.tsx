"use client";

import { useActionState, useState } from "react";
import { Gift, Package, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CommercialAddon,
  CommercialLimitMetric,
  PlatformModule,
} from "@/features/billing/use-cases/commercial-plans";
import { cn } from "@/components/ui/cn";
import { removeAddonAction, saveAddonAction } from "./actions";
import { PLATFORM_PLAN_IDLE_STATE } from "./action-state";
import { InlineState, Panel, StatusPill, SubmitButton } from "./workspace-ui";

interface AddonsCatalogData {
  addons: CommercialAddon[];
  modules: PlatformModule[];
  metrics: CommercialLimitMetric[];
}

export function AddonsCatalog({ data }: { data: AddonsCatalogData }) {
  const [selectedId, setSelectedId] = useState<string>(data.addons[0]?.id ?? "__new");
  const isCreateMode = selectedId === "__new";
  const selected = isCreateMode ? null : data.addons.find((addon) => addon.id === selectedId) ?? null;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
      <div className="grid h-[calc(100vh-210px)] min-h-[540px] lg:grid-cols-[300px_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-brand-100 bg-surface-muted/60 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Extras</p>
              <p className="mt-1 text-sm text-fg-subtle">{data.addons.length} en catalogo</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {data.addons.filter((addon) => addon.status === "active").length} activos
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            <button
              type="button"
              onClick={() => setSelectedId("__new")}
              className={cn(
                "mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
                isCreateMode
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-brand-100 bg-surface text-fg-secondary hover:border-brand-300 hover:text-brand-700"
              )}
            >
              <Plus className="h-4 w-4" />
              Nuevo extra
            </button>

            {data.addons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-brand-200 bg-surface px-4 py-8 text-center text-sm text-fg-subtle">
                Crea el primer extra para venderlo o regalarlo a salones.
              </div>
            ) : (
              data.addons.map((addon) => (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => setSelectedId(addon.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                    selected?.id === addon.id
                      ? "border-brand-300 bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-600)]"
                      : "border-transparent hover:border-brand-100 hover:bg-surface"
                  )}
                >
                  <span className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    selected?.id === addon.id
                      ? "border-brand-200 bg-surface text-brand-700"
                      : "border-border bg-surface text-fg-subtle"
                  )}>
                    {addon.kind === "module" ? <Package className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg-strong">{addon.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">
                      {addon.currency} {addon.monthlyPrice.toFixed(2)}/mes · {kindLabel(addon.kind)}
                    </span>
                  </span>
                  <StatusPill status={addon.status} />
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-surface">
          {selected ? (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-100 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold text-fg-strong">{selected.name}</h2>
                  <span className="rounded-lg bg-surface-sunken px-2 py-1 font-mono text-xs text-fg-muted">{selected.code}</span>
                </div>
                <p className="mt-1 text-sm text-fg-subtle">
                  {selected.description || "Extra vendible o regalable por salon."}
                </p>
              </div>
              <form action={removeAddonAction.bind(null, selected.id)}>
                <Button type="submit" variant="outline" className="border-danger-border text-danger-strong hover:bg-danger-subtle">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </form>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <AddonForm
              key={selected?.id ?? "__new"}
              addon={selected}
              modules={data.modules}
              metrics={data.metrics}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function AddonForm({
  addon,
  modules,
  metrics,
}: {
  addon: CommercialAddon | null;
  modules: PlatformModule[];
  metrics: CommercialLimitMetric[];
}) {
  const [state, action] = useActionState(saveAddonAction, PLATFORM_PLAN_IDLE_STATE);
  const [kind, setKind] = useState<CommercialAddon["kind"]>(addon?.kind ?? "module");

  return (
    <Panel
      icon={<Plus className="h-4 w-4" />}
      title={addon ? "Informacion del extra" : "Nuevo extra"}
      description="Un extra activa un modulo fuera del plan o aumenta un límite. Se vende a precio mensual o se regala desde Suscripciones."
    >
      <form action={action} className="space-y-4">
        {addon ? <input type="hidden" name="id" value={addon.id} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="name" label="Nombre" placeholder="Bloque de 1,000 citas" defaultValue={addon?.name ?? ""} required />
          <Input name="code" label="Codigo interno" placeholder="Se genera desde el nombre" defaultValue={addon?.code ?? ""} />
        </div>
        <Textarea name="description" label="Descripcion" rows={2} defaultValue={addon?.description ?? ""} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select name="kind" label="Tipo de extra" value={kind} onChange={(event) => setKind(event.target.value as CommercialAddon["kind"])}>
            <option value="module">Activa un modulo</option>
            <option value="limit_boost">Aumenta un límite</option>
          </Select>
          {kind === "module" ? (
            <Select name="moduleKey" label="Modulo que activa" defaultValue={addon?.moduleKey ?? ""}>
              <option value="">Selecciona un modulo</option>
              {modules.filter((module) => !module.isArchived).map((module) => (
                <option key={module.key} value={module.key}>{module.name}</option>
              ))}
            </Select>
          ) : (
            <Select name="metricKey" label="Límite que aumenta" defaultValue={addon?.metricKey ?? ""}>
              <option value="">Selecciona un límite</option>
              {metrics.filter((metric) => !metric.isArchived).map((metric) => (
                <option key={metric.key} value={metric.key}>{metric.name}</option>
              ))}
            </Select>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kind === "limit_boost" ? (
            <Input
              name="limitDelta"
              label="Cuanto aumenta"
              type="number"
              min="1"
              placeholder="1000"
              defaultValue={addon?.limitDelta ?? ""}
            />
          ) : null}
          <Input name="monthlyPrice" label="Precio mensual" type="number" min="0" step="0.01" defaultValue={addon?.monthlyPrice ?? 0} />
          <Input name="currency" label="Moneda" maxLength={3} defaultValue={addon?.currency ?? "USD"} />
          <Input name="sortOrder" label="Orden" type="number" defaultValue={addon?.sortOrder ?? 0} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select name="status" label="Estado" defaultValue={addon?.status ?? "active"}>
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </Select>
          <div className="flex items-end">
            <SubmitButton label={addon ? "Guardar cambios" : "Crear extra"} />
          </div>
        </div>
        <InlineState state={state} block />
      </form>
    </Panel>
  );
}

function kindLabel(kind: CommercialAddon["kind"]) {
  return kind === "module" ? "Modulo" : "Límite";
}
