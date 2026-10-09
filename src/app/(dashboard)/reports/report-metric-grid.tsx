// Tarjetas de metricas y aviso de modulo no activo, compartidos por las pestañas de reportes.

import type { ComponentProps } from "react";
import { PackageSearch } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { cn } from "@/components/ui/cn";

export interface MetricCardData {
  label: string;
  value: string;
  detail: string;
  tone: ComponentProps<typeof MetricCard>["tone"];
  visible: boolean;
}

export function MetricGrid({ cards }: { cards: MetricCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards
        .filter((card) => card.visible)
        .map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            help={card.detail}
            tone={card.tone}
          />
        ))}
    </div>
  );
}

export function UnavailableModule({ module, compact = false }: { module: string; compact?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-dashed border-border-strong bg-surface text-center", compact ? "p-8" : "p-16")}>
      <PackageSearch className="mx-auto h-7 w-7 text-fg-subtle" />
      <p className="mt-3 text-sm font-semibold text-fg-secondary">El módulo de {module} no está activo.</p>
      <p className="mt-1 text-sm text-fg-subtle">Los reportes omiten esos datos automáticamente.</p>
    </section>
  );
}
