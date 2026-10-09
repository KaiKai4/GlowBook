// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { MonthlyAppointmentPoint } from "@/features/dashboard/use-cases/get-dashboard-overview";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { MonthlyAppointmentsChart } from "./monthly-appointments-chart";

function point(monthKey: string, total: number): MonthlyAppointmentPoint {
  return { monthKey, label: monthKey, total, delta: 0, trend: "flat" };
}

function linePaths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("path"))
    .map((path) => path.getAttribute("d") ?? "")
    .filter((d) => d.startsWith("M "));
}

describe("MonthlyAppointmentsChart", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("renderiza el título sin trazo cuando no hay meses", () => {
    mounted = mountComponent(<MonthlyAppointmentsChart points={[]} />);

    expect(mounted.container.textContent).toContain("Citas completadas por mes");
    expect(linePaths(mounted.container)).toEqual([]);
  });

  it("con un solo mes dibuja un punto centrado y sin variación", () => {
    mounted = mountComponent(<MonthlyAppointmentsChart points={[point("2026-05", 7)]} />);

    const paths = linePaths(mounted.container);
    expect(paths.length).toBeGreaterThan(0);
    for (const d of paths) {
      expect(d).toMatch(/^M /);
      expect(d).not.toContain(" C ");
    }
  });

  it("con varios meses traza curvas entre todos los puntos", () => {
    mounted = mountComponent(
      <MonthlyAppointmentsChart points={[point("2026-03", 2), point("2026-04", 5), point("2026-05", 3)]} />
    );

    const [path] = linePaths(mounted.container);
    expect(path).toMatch(/^M /);
    expect(path?.match(/ C /g)).toHaveLength(2);
  });

  it("presenta el título como h2 de una sección con la leyenda y el periodo", () => {
    mounted = mountComponent(<MonthlyAppointmentsChart points={[point("2026-05", 7)]} />);

    const section = mounted.container.querySelector("section");
    expect(section?.querySelector("h2")?.textContent).toBe("Citas completadas por mes");
    expect(section?.textContent).toContain("Evolución de los últimos 12 meses");
    expect(section?.textContent).toContain("Citas completadas");
  });
});
