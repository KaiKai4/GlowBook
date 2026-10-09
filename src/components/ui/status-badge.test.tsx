// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { STOCK_STATUS_BADGES, StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el texto junto a un icono decorativo, nunca solo color", () => {
    mounted = mountComponent(<StatusBadge variant="danger" label="Agotado" />);

    const badge = mounted.container.querySelector("span");
    expect(badge?.textContent).toBe("Agotado");
    expect(badge?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["success", "bg-success-subtle", "text-success-strong"],
    ["warning", "bg-warning-subtle", "text-warning-strong"],
    ["danger", "bg-danger-subtle", "text-danger-strong"],
    ["info", "bg-info-subtle", "text-info-strong"],
    ["accent", "bg-accent-subtle", "text-accent-strong"],
    ["neutral", "bg-surface-sunken", "text-fg-secondary"],
  ] as const)("la variante %s usa los tokens de fondo, borde y texto", (variant, background, text) => {
    mounted = mountComponent(<StatusBadge variant={variant} label="Estado" />);

    const className = mounted.container.querySelector("span")?.className ?? "";
    expect(className).toContain(background);
    expect(className).toContain(text);
    expect(className).toContain("border");
  });

  it("acepta una clase adicional sin perder la variante", () => {
    mounted = mountComponent(<StatusBadge variant="info" label="Trial" className="ml-2" />);

    const className = mounted.container.querySelector("span")?.className ?? "";
    expect(className).toContain("ml-2");
    expect(className).toContain("bg-info-subtle");
  });

  it("el mapa de stock usa los textos que la app ya muestra", () => {
    expect(STOCK_STATUS_BADGES).toEqual({
      ok: { variant: "success", label: "Disponible" },
      low: { variant: "warning", label: "Stock bajo" },
      empty: { variant: "danger", label: "Agotado" },
    });
  });
});
