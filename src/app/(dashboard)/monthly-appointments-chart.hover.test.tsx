// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { MonthlyAppointmentPoint } from "@/features/dashboard/use-cases/get-dashboard-overview";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { MonthlyAppointmentsChart } from "./monthly-appointments-chart";

function point(label: string, total: number, delta: number): MonthlyAppointmentPoint {
  return { monthKey: `2026-${label}`, label, total, delta, trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
}

/** Activa un punto del gráfico como lo hace el foco del teclado (React escucha focusin). */
function focusPoint(container: HTMLElement, label: string): void {
  const target = container.querySelector(`[aria-label^="${label}:"]`);
  if (!target) throw new Error(`No se encontró el punto ${label}`);
  act(() => {
    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
}

function tooltipDelta(container: HTMLElement): Element | null {
  return Array.from(container.querySelectorAll("text")).find((node) => /^[+-]?\d+$/.test(node.textContent ?? "") && node.className.baseVal.includes("font-semibold") && node.getAttribute("text-anchor") === "end") ?? null;
}

describe("MonthlyAppointmentsChart (interacción)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("al enfocar un mes con aumento resalta su etiqueta y muestra el delta positivo", () => {
    mounted = mountComponent(
      <MonthlyAppointmentsChart points={[point("08", 4, 0), point("09", 9, 5), point("10", 6, -3)]} />
    );

    focusPoint(mounted.container, "09");

    const axisLabel = Array.from(mounted.container.querySelectorAll("text")).find((node) => node.textContent === "09");
    expect(axisLabel?.getAttribute("class")).toContain("fill-brand-700");
    const delta = tooltipDelta(mounted.container);
    expect(delta?.textContent).toBe("+5");
    expect(delta?.getAttribute("class")).toContain("fill-success");
  });

  it("al enfocar un mes con descenso muestra el delta negativo en tono de peligro", () => {
    mounted = mountComponent(
      <MonthlyAppointmentsChart points={[point("08", 4, 0), point("09", 9, 5), point("10", 6, -3)]} />
    );

    focusPoint(mounted.container, "10");

    const delta = tooltipDelta(mounted.container);
    expect(delta?.textContent).toBe("-3");
    expect(delta?.getAttribute("class")).toContain("fill-danger-border");
  });

  it("si el último mes supera al anterior la insignia de tendencia es de éxito", () => {
    mounted = mountComponent(
      <MonthlyAppointmentsChart points={[point("08", 4, 0), point("09", 9, 5), point("10", 12, 3)]} />
    );

    const badge = mounted.container.querySelector("span.rounded-full");
    expect(badge?.getAttribute("class")).toContain("bg-success-subtle");
    expect(badge?.textContent).toContain("3");
  });
});
