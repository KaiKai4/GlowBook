"use client";

import { useState } from "react";
import type { MonthlyAppointmentPoint } from "@/features/dashboard";
import { buildAreaChart, getMonthlyDelta } from "./monthly-chart-geometry";

/** Estado del punto activo (puntero o foco) y datos derivados del gráfico. */
export function useMonthlyChart(points: MonthlyAppointmentPoint[]) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chart = buildAreaChart(points);
  const delta = getMonthlyDelta(points);
  const activePoint = activeIndex === null ? null : (chart.points[activeIndex] ?? null);

  return { chart, delta, activeIndex, activePoint, setActiveIndex };
}
