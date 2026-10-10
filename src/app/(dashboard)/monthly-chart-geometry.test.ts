import { describe, expect, it } from "vitest";
import type { MonthlyAppointmentPoint } from "@/features/dashboard";
import { buildAreaChart, getMonthlyDelta, HEIGHT, PADDING, WIDTH } from "./monthly-chart-geometry";

function point(monthKey: string, total: number): MonthlyAppointmentPoint {
  return { monthKey, label: monthKey, total } as MonthlyAppointmentPoint;
}

describe("getMonthlyDelta", () => {
  it("es la diferencia entre el último mes y el anterior", () => {
    expect(getMonthlyDelta([point("2026-01", 4), point("2026-02", 9)])).toBe(5);
    expect(getMonthlyDelta([point("2026-01", 9), point("2026-02", 4)])).toBe(-5);
  });

  it("es cero si no hay dos meses para comparar", () => {
    expect(getMonthlyDelta([])).toBe(0);
    expect(getMonthlyDelta([point("2026-01", 4)])).toBe(0);
  });
});

describe("buildAreaChart", () => {
  it("sin puntos devuelve trazos vacíos y marcas del eje", () => {
    const chart = buildAreaChart([]);

    expect(chart.points).toEqual([]);
    expect(chart.path).toBe("");
    expect(chart.areaPath).toBe("");
    expect(chart.ticks).toHaveLength(5);
  });

  it("reparte los puntos de izquierda a derecha dentro del área de dibujo", () => {
    const chart = buildAreaChart([point("2026-01", 2), point("2026-02", 4), point("2026-03", 8)]);
    const [first, middle, last] = chart.points;

    expect(first?.x).toBe(PADDING.left);
    expect(last?.x).toBe(WIDTH - PADDING.right);
    expect(middle?.x).toBeGreaterThan(first?.x ?? 0);
    expect(middle?.x).toBeLessThan(last?.x ?? 0);
  });

  it("un único punto se centra horizontalmente", () => {
    const chart = buildAreaChart([point("2026-01", 3)]);

    expect(chart.points[0]?.x).toBe(PADDING.left + chart.innerWidth / 2);
  });

  it("el punto más alto queda por encima del más bajo y dentro del alto", () => {
    const chart = buildAreaChart([point("2026-01", 1), point("2026-02", 10)]);
    const [low, high] = chart.points;

    expect(high?.y).toBeLessThan(low?.y ?? 0);
    expect(high?.y).toBeGreaterThanOrEqual(PADDING.top);
    expect(low?.y).toBeLessThanOrEqual(HEIGHT - PADDING.bottom);
  });

  it("el eje Y va de 0 al múltiplo de cuatro que cubre el máximo", () => {
    const chart = buildAreaChart([point("2026-01", 10)]);

    expect(chart.ticks.map((tick) => tick.value)).toEqual([0, 3, 6, 9, 12]);
  });
});
