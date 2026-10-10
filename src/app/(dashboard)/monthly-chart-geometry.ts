import type { MonthlyAppointmentPoint } from "@/features/dashboard";

export const WIDTH = 720;
export const HEIGHT = 264;
export const PADDING = { top: 22, right: 18, bottom: 38, left: 50 };

export interface ChartPoint extends MonthlyAppointmentPoint {
  x: number;
  y: number;
}

export interface AreaChart {
  points: ChartPoint[];
  path: string;
  areaPath: string;
  ticks: Array<{ value: number; y: number }>;
  innerWidth: number;
  innerHeight: number;
}

/** Calcula coordenadas, curva suavizada, área y marcas del eje Y. Sin React. */
export function buildAreaChart(points: MonthlyAppointmentPoint[]): AreaChart {
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

/** Diferencia del último mes frente al anterior (0 si no hay dos meses). */
export function getMonthlyDelta(points: MonthlyAppointmentPoint[]): number {
  const latest = points.at(-1);
  const previous = points.at(-2);
  return latest && previous ? latest.total - previous.total : 0;
}
