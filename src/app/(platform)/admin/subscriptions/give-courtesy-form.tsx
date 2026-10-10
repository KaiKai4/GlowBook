"use client";

import { useActionState, useState } from "react";
import { HandHeart } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CommercialLimitMetric } from "@/features/billing/domain/commercial-plan";
import type { SubscriptionsPageData } from "@/features/billing/use-cases/salon-subscriptions-page";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import { InlineState, Panel, SubmitButton } from "../plans/workspace-ui";
import { giveManualExtraAction } from "./actions";

export function GiveCourtesyForm({
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
      description="Regalo puntual sin catalogo: util cuando un salon esta llegando a su límite y quieres darle margen."
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
            <option value="metric">Aumentar un límite</option>
            <option value="module">Activar un modulo</option>
          </Select>
          {targetType === "metric" ? (
            <Select name="metricKey" label="Límite" defaultValue={initialMetricKey ?? ""} required>
              <option value="">Selecciona un límite</option>
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
        <Input name="reason" label="Motivo / nota" placeholder="Ej. llego al límite de citas este mes" />
        <SubmitButton label="Regalar cortesia" />
        <InlineState state={state} block />
      </form>
    </Panel>
  );
}
