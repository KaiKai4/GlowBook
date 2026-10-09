// Geometria pura de los graficos de area de reportes (sin React ni DOM).

import type { ReportMonthPoint } from "@/features/reports/domain/analytics";
import { niceMaximum, smoothPath } from "./chart-format";

export const WIDTH = 760;
export const HEIGHT = 292;
export const PAD = { top: 22, right: 18, bottom: 40, left: 58 };
const TOOLTIP_WIDTH = 184;

export const PRODUCT_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export interface Series {
  key: keyof ReportMonthPoint;
  label: string;
  color: string;
  fill: string;
  value: (point: ReportMonthPoint) => number;
  format?: (value: number) => string;
}

/** Rango vertical del grafico: porcentajes en multiplos de 25; montos en un maximo redondeado. */
export function scaleRange(values: number[], percent: boolean): { min: number; max: number } {
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(1, ...values);
  const magnitude = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1);
  const max = percent ? Math.ceil(magnitude / 25) * 25 : niceMaximum(magnitude);
  const min = rawMin < 0 ? -max : 0;
  return { min, max };
}

export function buildChart(points: ReportMonthPoint[], series: Series[], min: number, max: number) {
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

/** Caja del tooltip: centrada en x, dentro del area util y alternada en vertical para evitar solapes. */
export function tooltipBox(x: number, index: number, seriesCount: number) {
  const height = 34 + seriesCount * 20;
  const left = Math.min(Math.max(x - TOOLTIP_WIDTH / 2, PAD.left), WIDTH - PAD.right - TOOLTIP_WIDTH);
  const top = PAD.top + 10 + (index % 2) * 8;
  return { left, top, width: TOOLTIP_WIDTH, height };
}
