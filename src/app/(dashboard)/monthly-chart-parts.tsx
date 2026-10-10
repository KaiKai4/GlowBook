import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { PADDING, WIDTH, type ChartPoint } from "./monthly-chart-geometry";

export function TrendBadge({ delta }: { delta: number }) {
  const label =
    delta === 0
      ? "Sin cambios"
      : `${delta > 0 ? "+" : ""}${delta} vs. mes anterior`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        delta > 0 && "bg-success-subtle text-success-fg",
        delta < 0 && "bg-danger-subtle text-danger-strong",
        delta === 0 && "bg-surface-sunken text-fg-muted"
      )}
    >
      {delta > 0 && <TrendingUp className="h-3.5 w-3.5" />}
      {delta < 0 && <TrendingDown className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function ChartTooltip({ point }: { point: ChartPoint }) {
  const width = 122;
  const height = 54;
  const x = Math.min(
    Math.max(point.x - width / 2, PADDING.left),
    WIDTH - PADDING.right - width
  );
  const y = Math.max(PADDING.top, point.y - height - 14);

  return (
    <g className="pointer-events-none">
      <rect x={x} y={y} width={width} height={height} rx="8" fill="var(--color-fg)" opacity="0.96" />
      <text x={x + 12} y={y + 20} className="fill-border-strong text-xs font-medium uppercase">
        {point.label}
      </text>
      <text x={x + 12} y={y + 40} className="fill-surface text-sm font-semibold">
        {point.total} {point.total === 1 ? "cita" : "citas"}
      </text>
      {point.delta !== 0 && (
        <text
          x={x + width - 10}
          y={y + 40}
          textAnchor="end"
          className={cn(
            "text-xs font-semibold",
            point.delta > 0 ? "fill-success" : "fill-danger-border"
          )}
        >
          {point.delta > 0 ? "+" : ""}
          {point.delta}
        </text>
      )}
    </g>
  );
}
