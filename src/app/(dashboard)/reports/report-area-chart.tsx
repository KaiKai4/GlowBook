"use client";

import { useId, useState } from "react";
import { formatCurrency } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type { ReportMonthPoint } from "@/features/reports/domain/analytics";
import { compactNumber } from "./chart-format";
import { ChartFrame } from "./report-chart-frame";
import {
  HEIGHT,
  PAD,
  WIDTH,
  buildChart,
  scaleRange,
  tooltipBox,
  type Series,
} from "./chart-layout";

export function MonthlyAreaChart({
  title,
  description,
  points,
  series,
  percent = false,
}: {
  title: string;
  description: string;
  points: ReportMonthPoint[];
  series: Series[];
  percent?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const [active, setActive] = useState<number | null>(null);
  const values = points.flatMap((point) => series.map((item) => item.value(point)));
  const { min, max } = scaleRange(values, percent);
  const chart = buildChart(points, series, min, max);
  const activePoint = active === null ? undefined : points[active];

  return (
    <ChartFrame title={title} description={description}>
      <div className="mb-3 flex flex-wrap justify-end gap-x-5 gap-y-2">
        {series.map((item) => (
          <span key={String(item.key)} className="inline-flex items-center gap-2 text-xs font-medium text-fg-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[292px] min-w-[640px] w-full"
          role="group"
          aria-label={`${title}. ${description}`}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            {series.map((item, index) => (
              <linearGradient key={String(item.key)} id={`${id}-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.fill} stopOpacity="0.42" />
                <stop offset="100%" stopColor={item.fill} stopOpacity="0.03" />
              </linearGradient>
            ))}
          </defs>

          {chart.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--color-brand-100)"
                strokeDasharray="3 5"
              />
              <text x={PAD.left - 10} y={tick.y + 4} textAnchor="end" className="fill-fg-subtle text-xs">
                {percent ? `${tick.value}%` : compactNumber(tick.value)}
              </text>
            </g>
          ))}

          {chart.series.map((item, index) => {
            const config = series[index];
            if (!config) throw new Error("Invariante de gráfico: serie sin configuración.");
            return (
              <g key={item.label}>
                <path d={item.area} fill={`url(#${id}-${index})`} />
                <path
                  d={item.path}
                  fill="none"
                  stroke={config.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
              </g>
            );
          })}

          {active !== null && (
            <line
              x1={chart.x(active)}
              x2={chart.x(active)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="var(--color-brand-300)"
              strokeDasharray="3 4"
            />
          )}

          {points.map((point, index) => (
            <g key={point.monthKey}>
              <rect
                x={chart.x(index) - chart.slot / 2}
                y={PAD.top}
                width={chart.slot}
                height={chart.innerHeight}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={point.label}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                onPointerMove={() => setActive(index)}
              />
              <text
                x={chart.x(index)}
                y={HEIGHT - 13}
                textAnchor="middle"
                className={cn(
                  "text-xs font-semibold uppercase",
                  active === index ? "fill-brand-700" : "fill-fg-subtle"
                )}
              >
                {point.label}
              </text>
            </g>
          ))}

          {activePoint !== undefined && active !== null && (
            <AreaTooltip
              point={activePoint}
              index={active}
              x={chart.x(active)}
              series={series}
              percent={percent}
            />
          )}
        </svg>
      </div>
    </ChartFrame>
  );
}

function AreaTooltip({
  point,
  index,
  x,
  series,
  percent,
}: {
  point: ReportMonthPoint;
  index: number;
  x: number;
  series: Series[];
  percent: boolean;
}) {
  const { left, top, width, height } = tooltipBox(x, index, series.length);

  return (
    <g className="pointer-events-none">
      <rect x={left} y={top} width={width} height={height} rx="9" fill="var(--color-fg)" opacity="0.96" />
      <text x={left + 12} y={top + 20} className="fill-border-strong text-xs font-semibold uppercase">
        {point.label}
      </text>
      {series.map((item, seriesIndex) => {
        const value = item.value(point);
        const formattedValue =
          item.format?.(value) ?? (percent ? `${value.toFixed(1)}%` : formatCurrency(value));
        return (
          <g key={String(item.key)}>
            <circle cx={left + 14} cy={top + 39 + seriesIndex * 20} r="3" fill={item.color} />
            <text
              x={left + 24}
              y={top + 43 + seriesIndex * 20}
              className="fill-surface text-xs"
            >
              <tspan>{item.label}: </tspan>
              <tspan className="font-semibold">{formattedValue}</tspan>
            </text>
          </g>
        );
      })}
    </g>
  );
}
