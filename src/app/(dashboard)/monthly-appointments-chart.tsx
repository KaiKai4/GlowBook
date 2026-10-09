"use client";

import { useId, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { MonthlyAppointmentPoint } from "@/features/dashboard/use-cases/get-dashboard-overview";

const WIDTH = 720;
const HEIGHT = 264;
const PADDING = { top: 22, right: 18, bottom: 38, left: 50 };

export function MonthlyAppointmentsChart({
  points,
}: {
  points: MonthlyAppointmentPoint[];
}) {
  const gradientId = useId().replaceAll(":", "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chart = buildAreaChart(points);
  const latest = points.at(-1);
  const previous = points.at(-2);
  const delta = latest && previous ? latest.total - previous.total : 0;
  const activePoint = activeIndex === null ? null : chart.points[activeIndex];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Citas completadas por mes</CardTitle>
            <p className="mt-1 text-xs text-fg-subtle">
              Evolución de los últimos 12 meses
            </p>
          </div>
          <TrendBadge delta={delta} />
        </div>
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-fg-muted">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" aria-hidden="true" />
            Citas completadas
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg-subtle">
            Aún no hay citas completadas para graficar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="h-[264px] w-full"
                role="group"
                aria-label="Gráfica de citas completadas durante los últimos 12 meses"
                onPointerLeave={() => setActiveIndex(null)}
              >
                <defs>
                  <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.34" />
                    <stop offset="72%" stopColor="var(--color-brand-400)" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="var(--color-brand-50)" stopOpacity="0" />
                  </linearGradient>
                  <filter id={`${gradientId}-shadow`} x="-10%" y="-20%" width="120%" height="150%">
                    <feDropShadow
                      dx="0"
                      dy="3"
                      stdDeviation="3"
                      floodColor="var(--color-brand-600)"
                      floodOpacity="0.18"
                    />
                  </filter>
                </defs>

                {chart.ticks.map((tick) => (
                  <g key={tick.value}>
                    <line
                      x1={PADDING.left}
                      x2={WIDTH - PADDING.right}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="var(--color-brand-100)"
                      strokeDasharray="3 5"
                    />
                    <text
                      x={PADDING.left - 10}
                      y={tick.y + 4}
                      textAnchor="end"
                      className="fill-fg-subtle text-xs"
                    >
                      {tick.value}
                    </text>
                  </g>
                ))}

                <path d={chart.areaPath} fill={`url(#${gradientId}-area)`} />
                <path
                  d={chart.path}
                  fill="none"
                  filter={`url(#${gradientId}-shadow)`}
                  stroke="var(--color-brand-600)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />

                {activePoint && (
                  <line
                    x1={activePoint.x}
                    x2={activePoint.x}
                    y1={PADDING.top}
                    y2={HEIGHT - PADDING.bottom}
                    stroke="var(--color-brand-300)"
                    strokeDasharray="3 4"
                  />
                )}

                {chart.points.map((point, index) => {
                  const active = activeIndex === index;
                  const slotWidth = chart.innerWidth / Math.max(points.length - 1, 1);

                  return (
                    <g key={point.monthKey}>
                      <rect
                        x={point.x - slotWidth / 2}
                        y={PADDING.top}
                        width={slotWidth}
                        height={chart.innerHeight}
                        fill="transparent"
                        tabIndex={0}
                        role="button"
                        aria-label={`${point.label}: ${point.total} citas completadas`}
                        onFocus={() => setActiveIndex(index)}
                        onBlur={() => setActiveIndex(null)}
                        onPointerEnter={() => setActiveIndex(index)}
                        onPointerMove={() => setActiveIndex(index)}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={active ? 5 : 3}
                        fill="var(--color-surface)"
                        stroke="var(--color-brand-600)"
                        strokeWidth={active ? 3 : 2}
                        className="pointer-events-none transition-all duration-150"
                      />
                      <text
                        x={point.x}
                        y={HEIGHT - 12}
                        textAnchor="middle"
                        className={cn(
                          "text-xs font-medium uppercase",
                          active ? "fill-brand-700" : "fill-fg-subtle"
                        )}
                      >
                        {point.label}
                      </text>
                    </g>
                  );
                })}

                {activePoint && <ChartTooltip point={activePoint} />}
              </svg>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendBadge({ delta }: { delta: number }) {
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

function ChartTooltip({ point }: { point: ChartPoint }) {
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

interface ChartPoint extends MonthlyAppointmentPoint {
  x: number;
  y: number;
}

function buildAreaChart(points: MonthlyAppointmentPoint[]) {
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const rawMax = Math.max(...points.map((point) => point.total), 1);
  const step = Math.max(1, Math.ceil(rawMax / 4));
  const max = step * 4;

  const chartPoints: ChartPoint[] = points.map((point, index) => ({
    ...point,
    x:
      PADDING.left +
      (points.length === 1
        ? innerWidth / 2
        : (index / (points.length - 1)) * innerWidth),
    y: PADDING.top + innerHeight - (point.total / max) * innerHeight,
  }));

  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = step * index;
    return {
      value,
      y: PADDING.top + innerHeight - (value / max) * innerHeight,
    };
  });

  if (chartPoints.length === 0) {
    return { points: chartPoints, path: "", areaPath: "", ticks, innerWidth, innerHeight };
  }

  const path = chartPoints.reduce((result, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = chartPoints[index - 1];
    if (!previous) throw new Error("Invariante de gráfico: punto previo ausente.");
    const control = (point.x - previous.x) * 0.42;
    return `${result} C ${previous.x + control} ${previous.y}, ${point.x - control} ${point.y}, ${point.x} ${point.y}`;
  }, "");

  const baseline = HEIGHT - PADDING.bottom;
  const first = chartPoints[0];
  const last = chartPoints.at(-1);
  if (!first || !last) throw new Error("Invariante de gráfico: se esperaban puntos.");

  return {
    points: chartPoints,
    path,
    areaPath: `${path} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`,
    ticks,
    innerWidth,
    innerHeight,
  };
}
