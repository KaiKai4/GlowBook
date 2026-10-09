"use client";

import { useId, useState } from "react";
import { formatCurrency } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type {
  BusyHourPoint,
  ProductMonthlySales,
  ReportMonthPoint,
  TopExpense,
} from "@/features/reports/domain/analytics";
import { compactNumber, niceMaximum, smoothPath } from "./chart-format";

const WIDTH = 760;
const HEIGHT = 292;
const PAD = { top: 22, right: 18, bottom: 40, left: 58 };

interface Series {
  key: keyof ReportMonthPoint;
  label: string;
  color: string;
  fill: string;
  value: (point: ReportMonthPoint) => number;
  format?: (value: number) => string;
}

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
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(1, ...values);
  const magnitude = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1);
  const max = percent ? Math.ceil(magnitude / 25) * 25 : niceMaximum(magnitude);
  const min = rawMin < 0 ? -max : 0;
  const chart = buildChart(points, series, min, max);
  const activePoint = active === null ? undefined : points[active];

  return (
    <ChartFrame title={title} description={description}>
      <div className="mb-3 flex flex-wrap justify-end gap-x-5 gap-y-2">
        {series.map((item) => (
          <span key={String(item.key)} className="inline-flex items-center gap-2 text-xs font-medium text-stone-600">
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
              <text x={PAD.left - 10} y={tick.y + 4} textAnchor="end" className="fill-stone-400 text-[10px]">
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
                  "text-[10px] font-semibold uppercase",
                  active === index ? "fill-brand-700" : "fill-stone-400"
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
  const width = 184;
  const height = 34 + series.length * 20;
  const left = Math.min(Math.max(x - width / 2, PAD.left), WIDTH - PAD.right - width);
  const top = PAD.top + 10 + (index % 2) * 8;

  return (
    <g className="pointer-events-none">
      <rect x={left} y={top} width={width} height={height} rx="9" fill="#1c1917" opacity="0.96" />
      <text x={left + 12} y={top + 20} className="fill-stone-300 text-[10px] font-semibold uppercase">
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
              className="fill-white text-[11px]"
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

export function BusyHoursChart({ points }: { points: BusyHourPoint[] }) {
  const max = Math.max(...points.map((point) => point.total), 1);
  return (
    <ChartFrame title="Horas más ocupadas" description="Distribución histórica de citas activas por hora">
      {points.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-[270px] items-end gap-2 overflow-x-auto px-2 pt-6">
          {points.map((point) => (
            <div key={point.hour} className="group flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
              <span className="opacity-0 transition-opacity group-hover:opacity-100 text-xs font-semibold text-stone-700">
                {point.total}
              </span>
              <div
                className="w-full max-w-12 rounded-t-md bg-brand-500/80 transition-colors group-hover:bg-brand-600"
                style={{ height: `${Math.max(12, (point.total / max) * 190)}px` }}
                title={`${point.label}: ${point.total} citas`}
              />
              <span className="whitespace-nowrap text-[10px] font-medium text-stone-500">{point.label}</span>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}

const PRODUCT_COLORS = ["#7c3aed", "#38bdf8", "#14b8a6", "#f59e0b", "#ec4899"];

export function ProductSalesChart({
  products,
  months,
}: {
  products: ProductMonthlySales[];
  months: ReportMonthPoint[];
}) {
  const max = Math.max(...products.flatMap((product) => product.months), 1);
  return (
    <ChartFrame title="Productos más vendidos por mes" description="Unidades vendidas en vitrina durante los últimos 12 meses">
      {products.length === 0 ? (
        <EmptyChart label="Aún no hay ventas de productos para graficar." />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap justify-end gap-x-4 gap-y-2">
            {products.map((product, index) => (
              <span key={product.id} className="inline-flex items-center gap-2 text-xs text-stone-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PRODUCT_COLORS[index] }} />
                {product.name}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <div className="flex h-[250px] min-w-[680px] items-end gap-3 border-b border-stone-200 px-2">
              {months.map((month, monthIndex) => (
                <div key={month.monthKey} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div className="flex flex-1 items-end justify-center gap-1">
                    {products.map((product, productIndex) => (
                      <div
                        key={product.id}
                        className="w-full max-w-3 rounded-t-sm transition-opacity hover:opacity-75"
                        style={{
                          height: `${Math.max((product.months[monthIndex] ?? 0) > 0 ? 6 : 0, ((product.months[monthIndex] ?? 0) / max) * 190)}px`,
                          background: PRODUCT_COLORS[productIndex],
                        }}
                        title={`${month.label}, ${product.name}: ${product.months[monthIndex] ?? 0} unidades`}
                      />
                    ))}
                  </div>
                  <span className="pb-2 text-center text-[10px] font-semibold uppercase text-stone-500">
                    {month.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </ChartFrame>
  );
}

export function TopExpensesChart({ expenses }: { expenses: TopExpense[] }) {
  const max = Math.max(...expenses.map((expense) => expense.amount), 1);
  return (
    <ChartFrame title="Top 5 gastos" description="Conceptos con mayor egreso durante los últimos 12 meses">
      {expenses.length === 0 ? (
        <EmptyChart label="Aún no hay gastos para comparar." />
      ) : (
        <div className="space-y-5 py-3">
          {expenses.map((expense, index) => (
            <div key={expense.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-xs font-bold text-red-600">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-stone-700">{expense.label}</span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-stone-900">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-red-50">
                <div
                  className="h-full rounded-full bg-red-300"
                  style={{ width: `${Math.max(4, (expense.amount / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}

function ChartFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ label = "Aún no hay datos para graficar." }: { label?: string }) {
  return <p className="py-20 text-center text-sm text-stone-500">{label}</p>;
}

function buildChart(points: ReportMonthPoint[], series: Series[], min: number, max: number) {
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const range = max - min || 1;
  const x = (index: number) =>
    PAD.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - ((value - min) / range) * innerHeight;
  const baseline = y(0);

  return {
    x,
    slot: innerWidth / Math.max(points.length - 1, 1),
    innerHeight,
    ticks: Array.from({ length: 5 }, (_, index) => {
      const value = min + (range / 4) * index;
      return { value: Math.round(value), y: y(value) };
    }),
    series: series.map((item) => {
      const coordinates = points.map((point, index) => ({ x: x(index), y: y(item.value(point)) }));
      const path = smoothPath(coordinates);
      const first = coordinates[0];
      const last = coordinates.at(-1);
      return {
        label: item.label,
        path,
        area: first && last ? `${path} L ${last.x} ${baseline} L ${first.x} ${baseline} Z` : "",
      };
    }),
  };
}
