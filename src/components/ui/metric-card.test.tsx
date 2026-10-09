// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { MetricCard } from "./metric-card";

describe("MetricCard", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra etiqueta y valor en tono principal por defecto", () => {
    mounted = mountComponent(<MetricCard label="Productos" value={12} />);

    expect(mounted.container.textContent).toBe("Productos12");
    expect(mounted.container.querySelector("p.mt-1")?.className).toContain("text-fg");
  });

  it("aplica el tono de advertencia al valor cuando se indica", () => {
    mounted = mountComponent(<MetricCard label="Bajos o agotados" value={3} tone="warning" />);

    expect(mounted.container.querySelector("p.mt-1")?.className).toContain("text-warning-fg");
  });

  it("muestra la ayuda cuando se indica y no la muestra si falta", () => {
    mounted = mountComponent(<MetricCard label="Movimientos" value={0} help="Últimos 30 días" />);
    expect(mounted.container.textContent).toContain("Últimos 30 días");
    mounted.unmount();

    mounted = mountComponent(<MetricCard label="Movimientos" value={0} />);
    expect(mounted.container.querySelectorAll("p")).toHaveLength(2);
  });

  it("muestra la tendencia con icono y texto, y con tono neutral por defecto", () => {
    mounted = mountComponent(<MetricCard label="Ingresos" value="1.200" trend={{ direction: "up", label: "+8 % vs. mes anterior" }} />);

    const trend = mounted.container.querySelector("svg")?.parentElement;
    expect(trend?.textContent).toBe("+8 % vs. mes anterior");
    expect(trend?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(trend?.className).toContain("text-fg-muted");
  });

  it("colorea la tendencia positiva o negativa según el tono indicado", () => {
    mounted = mountComponent(<MetricCard label="Cancelaciones" value={4} trend={{ direction: "down", label: "-2", tone: "positive" }} />);
    expect(mounted.container.querySelector("svg")?.parentElement?.className).toContain("text-success-fg");
    mounted.unmount();

    mounted = mountComponent(<MetricCard label="Cancelaciones" value={4} trend={{ direction: "up", label: "+2", tone: "negative" }} />);
    expect(mounted.container.querySelector("svg")?.parentElement?.className).toContain("text-danger-strong");
  });

  it("usa el icono plano para una tendencia sin cambio", () => {
    mounted = mountComponent(<MetricCard label="Stock" value={5} trend={{ direction: "flat", label: "Sin cambios" }} />);

    expect(mounted.container.querySelector("svg")?.parentElement?.textContent).toBe("Sin cambios");
  });
});
