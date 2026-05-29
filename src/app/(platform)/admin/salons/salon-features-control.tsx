"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SALON_FEATURES,
  normalizeDisabledSalonFeatures,
  type SalonFeatureKey,
} from "@/features/salon/domain/salon-features";
import { updateSalonDisabledFeaturesAction } from "../actions";

interface Props {
  salonId: string;
  disabledFeatures: SalonFeatureKey[];
}

export function SalonFeaturesControl({ salonId, disabledFeatures }: Props) {
  const initialEnabled = useMemo(
    () => new Set(SALON_FEATURES.map((feature) => feature.key).filter(
      (key) => !disabledFeatures.includes(key)
    )),
    [disabledFeatures]
  );
  const [enabledFeatures, setEnabledFeatures] = useState(initialEnabled);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleFeature(feature: SalonFeatureKey, enabled: boolean) {
    setMessage(null);
    setEnabledFeatures((current) => {
      const next = new Set(current);
      if (enabled) next.add(feature);
      else next.delete(feature);
      return next;
    });
  }

  function save() {
    const nextDisabled = SALON_FEATURES
      .map((feature) => feature.key)
      .filter((key) => !enabledFeatures.has(key));

    startTransition(async () => {
      const result = await updateSalonDisabledFeaturesAction(
        salonId,
        normalizeDisabledSalonFeatures(nextDisabled)
      );
      setMessage(result.ok ? "Guardado" : result.error);
    });
  }

  const disabledCount = SALON_FEATURES.length - enabledFeatures.size;

  return (
    <div className="min-w-[260px] space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {SALON_FEATURES.map((feature) => {
          const isEnabled = enabledFeatures.has(feature.key);

          return (
            <label
              key={feature.key}
              title={feature.description}
              className="flex min-h-8 items-center gap-2 rounded-lg border border-neutral-100 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700"
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(event) => toggleFeature(feature.key, event.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="truncate">{feature.label}</span>
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-neutral-400">
          {disabledCount === 0 ? "Todo permitido" : `${disabledCount} bloqueado(s)`}
        </p>
        <Button type="button" size="sm" variant="outline" loading={isPending} onClick={save}>
          <Save className="h-3.5 w-3.5" />
          Guardar
        </Button>
      </div>
      {message ? (
        <p className="text-[11px] font-medium text-neutral-500">{message}</p>
      ) : null}
    </div>
  );
}
