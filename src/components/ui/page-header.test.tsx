// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("renderiza el título como único h1", () => {
    mounted = mountComponent(<PageHeader title="Clientes" />);

    const headings = mounted.container.querySelectorAll("h1");
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe("Clientes");
  });

  it("muestra la descripción solo cuando se indica", () => {
    mounted = mountComponent(<PageHeader title="Clientes" description="3 clientes activos" />);
    expect(mounted.container.querySelector("p")?.textContent).toBe("3 clientes activos");
    mounted.unmount();

    mounted = mountComponent(<PageHeader title="Clientes" />);
    expect(mounted.container.querySelector("p")).toBeNull();
  });

  it("agrupa las acciones a la derecha y las apila en móvil", () => {
    mounted = mountComponent(<PageHeader title="Clientes" actions={<button type="button">Nuevo</button>} />);

    const root = mounted.container.firstElementChild;
    expect(root?.className).toContain("flex-col");
    expect(root?.className).toContain("sm:flex-row");
    expect(mounted.container.querySelector("button")?.textContent).toBe("Nuevo");
  });

  it("no crea contenedor de acciones cuando no hay acciones", () => {
    mounted = mountComponent(<PageHeader title="Inventario" />);

    expect(mounted.container.querySelector("button")).toBeNull();
    expect(mounted.container.firstElementChild?.children).toHaveLength(1);
  });
});
