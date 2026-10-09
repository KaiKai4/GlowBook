// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { StatusPill, StatusText } from "./workspace-ui";

describe("StatusPill", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("usa el tono verde para planes activos", () => {
    mounted = mountComponent(<StatusPill status="active" />);

    expect(mounted.container.textContent).toBe("Activo");
    expect(mounted.container.querySelector("span")?.className).toContain("bg-success-subtle");
  });

  it("usa el tono gris para planes archivados", () => {
    mounted = mountComponent(<StatusPill status="archived" />);

    expect(mounted.container.textContent).toBe("Archivado");
    expect(mounted.container.querySelector("span")?.className).toContain("bg-surface-sunken");
  });

  it("usa el tono azul para borradores", () => {
    mounted = mountComponent(<StatusPill status="draft" />);

    expect(mounted.container.textContent).toBe("Borrador");
    expect(mounted.container.querySelector("span")?.className).toContain("bg-info-subtle");
  });
});

describe("StatusText", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el texto activo con tono verde cuando está activo", () => {
    mounted = mountComponent(<StatusText active activeText="Visible" inactiveText="Oculto" />);

    expect(mounted.container.textContent).toBe("Visible");
    expect(mounted.container.querySelector("span")?.className).toContain("text-success-strong");
  });

  it("muestra el texto inactivo con tono gris cuando no lo está", () => {
    mounted = mountComponent(<StatusText active={false} activeText="Visible" inactiveText="Oculto" />);

    expect(mounted.container.textContent).toBe("Oculto");
    expect(mounted.container.querySelector("span")?.className).toContain("text-fg-muted");
  });
});
