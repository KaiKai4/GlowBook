// Tarjetas de metricas y aviso de modulo no activo, compartidos por las pestañas de reportes.

import { PackageSearch } from "lucide-react";
import { cn } from "@/components/ui/cn";

type MetricTone = "positive" | "negative" | "brand" | "blue" | "amber";

export interface MetricCardData {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: MetricTone;
  visible: boolean;
}

const TONES: Record<MetricTone, { icon: string; surface: string }> = {
  positive: { icon: "text-success-fg", surface: "bg-success-subtle" },
  negative: { icon: "text-danger-strong", surface: "bg-danger-subtle" },
  brand: { icon: "text-brand-700", surface: "bg-brand-50" },
  blue: { icon: "text-info-fg", surface: "bg-info-subtle" },
  amber: { icon: "text-warning-fg", surface: "bg-warning-subtle" },
};

export function MetricGrid({ cards }: { cards: MetricCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.filter((card) => card.visible).map((card) => {
        const Icon = card.icon;
        const tone = TONES[card.tone];
        return (
          <article key={card.label} className="rounded-xl border border-brand-100 bg-surface p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg-muted">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-fg-strong">{card.value}</p>
                <p className="mt-1 text-xs text-fg-subtle">{card.detail}</p>
              </div>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone.surface)}>
                <Icon className={cn("h-5 w-5", tone.icon)} />
              </span>
            </div>
          </article>
        );
      })}
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
