"use client";

import { useActionState, useMemo, useState } from "react";
import { Gift, ShoppingCart } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CommercialAddon } from "@/features/billing";
import type { CommercialLimitMetric } from "@/features/billing/domain/commercial-plan";
import type { SalonExtraView } from "@/features/billing";
import type { SubscriptionsPageData } from "@/features/billing";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import { InlineState, Panel, SubmitButton } from "../plans/workspace-ui";
import { giveAddonAction } from "./actions";
import { ActiveExtrasList } from "./active-extras-list";
import { GiveCourtesyForm } from "./give-courtesy-form";

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
  /** Límite que el admin quiere ampliar (viene del panel de uso). */
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
            ? " El extra del catálogo que lo aumenta ya está seleccionado: véndelo o regálalo."
            : " No hay un extra de catálogo para este límite: usa la cortesia personalizada o crea el extra en Planes → Extras."}
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
      title="Asignar extra del catálogo"
      description="Vende un extra al precio del catálogo, ajusta el precio o marcalo como regalo."
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
              placeholder={selected ? selected.monthlyPrice.toFixed(2) : "Precio del catálogo"}
            />
          ) : null}
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-accent-border bg-accent-subtle/50 px-3 text-sm font-medium text-fg-secondary">
          <span className="inline-flex items-center gap-2">
            <Gift className="h-4 w-4 text-accent" />
            Regalar sin costo
          </span>
          <input
            name="isGift"
            type="checkbox"
            checked={isGift}
            onChange={(event) => setIsGift(event.target.checked)}
            className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
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

