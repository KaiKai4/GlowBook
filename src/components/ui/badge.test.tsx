// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { Badge } from "./badge";

describe("Badge", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function badgeElement(): HTMLElement {
    const element = mounted?.container.querySelector<HTMLElement>("span");
    if (!element) throw new Error("Falta el badge");
    return element;
  }

  it("renderiza su contenido con la variante por defecto", () => {
    mounted = mountComponent(<Badge>Activo</Badge>);

    expect(badgeElement().textContent).toBe("Activo");
    expect(badgeElement().className).toContain("bg-surface-sunken");
  });

  it.each([
    ["success", "bg-success-subtle"],
    ["warning", "bg-warning-subtle"],
    ["danger", "bg-danger-subtle"],
    ["info", "bg-info-subtle"],
    ["primary", "bg-accent-subtle"],
  ] as const)("la variante %s aplica sus colores semánticos", (variant, expectedClass) => {
    mounted = mountComponent(<Badge variant={variant}>Estado</Badge>);

    expect(badgeElement().className).toContain(expectedClass);
    expect(badgeElement().className).not.toContain("bg-surface-sunken");
  });

  it("combina className con las clases base y resuelve conflictos a favor de className", () => {
    mounted = mountComponent(<Badge className="bg-red-500">Error</Badge>);

    expect(badgeElement().className).toContain("bg-red-500");
    expect(badgeElement().className).not.toContain("bg-surface-sunken");
    expect(badgeElement().className).toContain("rounded-full");
  });

  it("reenvía atributos HTML al elemento", () => {
    mounted = mountComponent(<Badge title="Pendiente de pago" data-testid="badge">Pago</Badge>);

    expect(badgeElement().getAttribute("title")).toBe("Pendiente de pago");
    expect(badgeElement().getAttribute("data-testid")).toBe("badge");
  });
});
