"use client";

import { useActionState, useMemo, useState } from "react";
import { Gift, HandHeart, ShoppingCart, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CommercialAddon } from "@/features/billing/use-cases/commercial-addons";
import type { CommercialLimitMetric } from "@/features/billing/domain/commercial-plan";
import type {
  SalonExtraView,
  SubscriptionsPageData,
} from "@/features/billing/use-cases/salon-subscriptions";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import { InlineState, Panel, SubmitButton } from "../plans/workspace-ui";
import { cancelExtraAction, giveAddonAction, giveManualExtraAction } from "./actions";

export function ExtrasPanel({
  salonId,
  extras,
  addons,
  metrics,
  modules,
  suggestedMetricKey = null,
}: {
  salonId: string;
  extras: SalonExtraView[];
  addons: CommercialAddon[];
  metrics: CommercialLimitMetric[];
  modules: SubscriptionsPageData["modules"];
  /** Limite que el admin quiere ampliar (viene del panel de uso). */
  suggestedMetricKey?: string | null;
}) {
  const suggestedAddon = suggestedMetricKey
    ? addons.find((addon) => addon.kind === "limit_boost" && addon.metricKey === suggestedMetricKey) ?? null
    : null;
  const suggestedMetricName = suggestedMetricKey
    ? metrics.find((metric) => metric.key === suggestedMetricKey)?.name ?? null
    : null;

  return (
    <div className="space-y-5">
      {suggestedMetricName ? (
        <p className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-sm text-brand-800">
          Estas ampliando <span className="font-semibold">{suggestedMetricName}</span>.
          {suggestedAddon
            ? " El extra del catalogo que lo aumenta ya esta seleccionado: vendelo o regalalo."
            : " No hay un extra de catalogo para este limite: usa la cortesia personalizada o crea el extra en Planes → Extras."}
        </p>
      ) : null}
      <ActiveExtrasList salonId={salonId} extras={extras} />
      <div className="grid gap-4 xl:grid-cols-2">
        <GiveAddonForm salonId={salonId} addons={addons} initialAddonId={suggestedAddon?.id} />
        <GiveCourtesyForm
          salonId={salonId}
          metrics={metrics}
          modules={modules}
          initialMetricKey={!suggestedAddon ? suggestedMetricKey : null}
        />
      </div>
    </div>
  );
}

function ActiveExtrasList({ salonId, extras }: { salonId: string; extras: SalonExtraView[] }) {
  return (
    <Panel
      icon={<Gift className="h-4 w-4" />}
      title="Extras vigentes"
      description="Modulos y aumentos de limite activos para este salon, vendidos o regalados."
    >
      {extras.length === 0 ? (
        <p className="text-sm text-stone-500">Este salon no tiene extras vigentes.</p>
      ) : (
        <div className="space-y-2">
          {extras.map((extra) => (
            <div
              key={extra.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-stone-950">
                    {extra.name}
                    {extra.quantity > 1 ? ` × ${extra.quantity}` : ""}
                  </p>
                  {extra.isGift ? (
                    <span className="rounded-lg bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-600">Regalo</span>
                  ) : (
                    <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      USD {extra.monthlyPrice.toFixed(2)}/mes
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-stone-500">
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
                  className="border-red-200 text-red-500 hover:bg-red-50"
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

function GiveAddonForm({
  salonId,
  addons,
  initialAddonId,
}: {
  salonId: string;
  addons: CommercialAddon[];
  initialAddonId?: string;
}) {
  const [state, action] = useActionState(giveAddonAction, PLATFORM_PLAN_IDLE_STATE);
  const [addonId, setAddonId] = useState(initialAddonId ?? addons[0]?.id ?? "");
  const [isGift, setIsGift] = useState(false);
  const selected = useMemo(() => addons.find((addon) => addon.id === addonId) ?? null, [addons, addonId]);

  return (
    <Panel
      icon={<ShoppingCart className="h-4 w-4" />}
      title="Asignar extra del catalogo"
      description="Vende un extra al precio del catalogo, ajusta el precio o marcalo como regalo."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="salonId" value={salonId} />
        <Select name="addonId" label="Extra" value={addonId} onChange={(event) => setAddonId(event.target.value)} required>
          <option value="">Selecciona un extra</option>
          {addons.map((addon) => (
            <option key={addon.id} value={addon.id}>
              {addon.name} — {addon.currency} {addon.monthlyPrice.toFixed(2)}/mes
            </option>
          ))}
        </Select>
        <div className="grid gap-3 sm:grid-cols-2">
          {selected?.kind === "limit_boost" ? (
            <Input name="quantity" label="Cantidad" type="number" min="1" defaultValue={1} />
          ) : null}
          {!isGift ? (
            <Input
              name="priceOverride"
              label="Precio especial (opcional)"
              type="number"
              min="0"
              step="0.01"
              placeholder={selected ? selected.monthlyPrice.toFixed(2) : "Precio del catalogo"}
            />
          ) : null}
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-pink-100 bg-pink-50/50 px-3 text-sm font-medium text-stone-700">
          <span className="inline-flex items-center gap-2">
            <Gift className="h-4 w-4 text-pink-500" />
            Regalar sin costo
          </span>
          <input
            name="isGift"
            type="checkbox"
            checked={isGift}
            onChange={(event) => setIsGift(event.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-pink-600 focus:ring-pink-500"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="startsAt" label="Inicio (opcional)" type="date" />
          <Input name="endsAt" label="Vence (opcional)" type="date" />
        </div>
        <Input name="reason" label="Motivo / nota" placeholder="Ej. promo de lanzamiento" />
        <SubmitButton label={isGift ? "Regalar extra" : "Asignar extra"} />
        <InlineState state={state} block />
      </form>
    </Panel>
  );
}

function GiveCourtesyForm({
  salonId,
  metrics,
  modules,
  initialMetricKey = null,
}: {
  salonId: string;
  metrics: CommercialLimitMetric[];
  modules: SubscriptionsPageData["modules"];
  initialMetricKey?: string | null;
}) {
  const [state, action] = useActionState(giveManualExtraAction, PLATFORM_PLAN_IDLE_STATE);
  const [targetType, setTargetType] = useState<"metric" | "module">("metric");

  return (
    <Panel
      icon={<HandHeart className="h-4 w-4" />}
      title="Cortesia personalizada"
      description="Regalo puntual sin catalogo: util cuando un salon esta llegando a su limite y quieres darle margen."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="salonId" value={salonId} />
        <input type="hidden" name="targetType" value={targetType} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            name="__targetType"
            label="Tipo de cortesia"
            value={targetType}
            onChange={(event) => setTargetType(event.target.value as "metric" | "module")}
          >
            <option value="metric">Aumentar un limite</option>
            <option value="module">Activar un modulo</option>
          </Select>
          {targetType === "metric" ? (
            <Select name="metricKey" label="Limite" defaultValue={initialMetricKey ?? ""} required>
              <option value="">Selecciona un limite</option>
              {metrics.map((metric) => (
                <option key={metric.key} value={metric.key}>{metric.name}</option>
              ))}
            </Select>
          ) : (
            <Select name="moduleKey" label="Modulo" defaultValue="" required>
              <option value="">Selecciona un modulo</option>
              {modules.map((module) => (
                <option key={module.key} value={module.key}>{module.name}</option>
              ))}
            </Select>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {targetType === "metric" ? (
            <Input name="maxDelta" label="Cuanto agregar" type="number" min="1" placeholder="100" required />
          ) : null}
          <Input name="startsAt" label="Inicio (opcional)" type="date" />
          <Input name="endsAt" label="Vence (opcional)" type="date" />
        </div>
        <Input name="reason" label="Motivo / nota" placeholder="Ej. llego al limite de citas este mes" />
        <SubmitButton label="Regalar cortesia" />
        <InlineState state={state} block />
      </form>
    </Panel>
  );
}
