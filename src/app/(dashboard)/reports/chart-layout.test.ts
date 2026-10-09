import { describe, expect, it } from "vitest";
import type { ReportMonthPoint } from "@/features/reports/domain/analytics";
import { PAD, PRODUCT_COLORS, WIDTH, buildChart, scaleRange, tooltipBox, type Series } from "./chart-layout";

function point(monthKey: string, totalRevenue: number): ReportMonthPoint {
  return {
    monthKey,
    label: monthKey,
    appointmentRevenue: totalRevenue,
    retailRevenue: 0,
    totalRevenue,
    operationalExpenses: 0,
    inventoryPurchases: 0,
    totalExpenses: 0,
    profit: totalRevenue,
    marginPct: 100,
    completedAppointments: 1,
  };
}

const revenue: Series = {
  key: "totalRevenue",
  label: "Ingresos",
  color: "#000",
  fill: "#fff",
  value: (item) => item.totalRevenue,
};

describe("scaleRange", () => {
  it("redondea montos a un maximo de orden de magnitud y empieza en cero si no hay negativos", () => {
    expect(scaleRange([10, 50], false)).toEqual({ min: 0, max: 50 });
    expect(scaleRange([], false)).toEqual({ min: 0, max: 1 });
  });

  it("usa multiplos de 25 para porcentajes", () => {
    expect(scaleRange([10, 60], true)).toEqual({ min: 0, max: 75 });
  });

  it("refleja el minimo negativo simetricamente", () => {
    expect(scaleRange([-30, 20], false)).toEqual({ min: -30, max: 30 });
  });
});

describe("buildChart", () => {
  it("distribuye los puntos en el ancho util y ubica la base en el valor cero", () => {
    const chart = buildChart([point("a", 0), point("b", 100), point("c", 50)], [revenue], 0, 100);

    expect(chart.x(0)).toBe(PAD.left);
    expect(chart.x(2)).toBe(WIDTH - PAD.right);
    expect(chart.slot).toBe((WIDTH - PAD.left - PAD.right) / 2);
  });

  it("genera cinco marcas de eje entre el minimo y el maximo", () => {
    const chart = buildChart([point("a", 0), point("b", 100)], [revenue], 0, 100);

    expect(chart.ticks.map((tick) => tick.value)).toEqual([0, 25, 50, 75, 100]);
    expect(chart.ticks[0]?.y).toBeGreaterThan(chart.ticks[4]?.y ?? Infinity);
  });

  it("deja el area y el trazo vacios cuando no hay puntos", () => {
    const chart = buildChart([], [revenue], 0, 1);

    expect(chart.series).toEqual([{ label: "Ingresos", path: "", area: "" }]);
  });

  it("cierra el area de la serie sobre la linea base", () => {
    const chart = buildChart([point("a", 10), point("b", 20)], [revenue], 0, 20);

    expect(chart.series[0]?.area).toMatch(/ L .* Z$/);
    expect(chart.series[0]?.path.startsWith("M ")).toBe(true);
  });
});

describe("tooltipBox", () => {
  it("centra la caja sobre el punto activo", () => {
    expect(tooltipBox(400, 0, 1)).toEqual({ left: 308, top: PAD.top + 10, width: 184, height: 54 });
  });

  it("no sale del area util por la izquierda ni por la derecha", () => {
    expect(tooltipBox(60, 1, 2).left).toBe(PAD.left);
    expect(tooltipBox(740, 0, 1).left).toBe(WIDTH - PAD.right - 184);
  });

  it("alterna la altura en puntos impares y crece con el numero de series", () => {
    expect(tooltipBox(400, 1, 2)).toMatchObject({ top: PAD.top + 18, height: 74 });
  });
});

describe("PRODUCT_COLORS", () => {
  it("usa los cinco tokens de grafico del tema", () => {
    expect(PRODUCT_COLORS).toEqual([
      "var(--color-chart-1)",
      "var(--color-chart-2)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
      "var(--color-chart-5)",
    ]);
  });
});
