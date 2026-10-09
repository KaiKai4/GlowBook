import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MetricTone = "default" | "success" | "warning" | "danger";

interface MetricTrend {
  direction: "up" | "down" | "flat";
  /** Texto que explica la variación; el color nunca es el único portador de significado. */
  label: string;
  tone?: "positive" | "negative" | "neutral";
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** Color del valor. Por defecto, texto principal. */
  tone?: MetricTone;
  /** Línea de ayuda bajo el valor, opcional. */
  help?: string;
  /** Variación con icono y texto, opcional. */
  trend?: MetricTrend;
}

const VALUE_TONE: Record<MetricTone, string> = {
  default: "text-fg",
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger: "text-danger",
};

const TREND_ICON: Record<MetricTrend["direction"], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const TREND_TONE: Record<NonNullable<MetricTrend["tone"]>, string> = {
  positive: "text-success-fg",
  negative: "text-danger-strong",
  neutral: "text-fg-muted",
};

export function MetricCard({ label, value, tone = "default", help, trend }: MetricCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", VALUE_TONE[tone])}>{value}</p>
      {help !== undefined && <p className="mt-1 text-xs text-fg-subtle">{help}</p>}
      {trend && TrendIcon && (
        <p className={cn("mt-2 flex items-center gap-1 text-sm font-medium", TREND_TONE[trend.tone ?? "neutral"])}>
          <TrendIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {trend.label}
        </p>
      )}
    </div>
  );
}
