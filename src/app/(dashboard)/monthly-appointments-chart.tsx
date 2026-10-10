"use client";

import { useId } from "react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/components/ui/cn";
import type { MonthlyAppointmentPoint } from "@/features/dashboard";
import { HEIGHT, PADDING, WIDTH } from "./monthly-chart-geometry";
import { ChartTooltip, TrendBadge } from "./monthly-chart-parts";
import { useMonthlyChart } from "./use-monthly-chart";

export function MonthlyAppointmentsChart({
  points,
}: {
  points: MonthlyAppointmentPoint[];
}) {
  const gradientId = useId().replaceAll(":", "");
  const { chart, delta, activeIndex, activePoint, setActiveIndex } = useMonthlyChart(points);

  return (
    <Panel
      className="overflow-hidden"
      title="Citas completadas por mes"
      actions={<TrendBadge delta={delta} />}
    >
      <div className="space-y-3">
        <p className="text-xs text-fg-subtle">Evolución de los últimos 12 meses</p>
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-fg-muted">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" aria-hidden="true" />
            Citas completadas
          </div>
        </div>
      </div>
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
    </Panel>
  );
}
