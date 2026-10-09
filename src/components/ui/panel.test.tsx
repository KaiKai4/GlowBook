// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { Panel } from "./panel";

describe("Panel", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("es una sección con borde y superficie y muestra sus hijos", () => {
    mounted = mountComponent(<Panel><p>Contenido</p></Panel>);

    const section = mounted.container.querySelector("section");
    expect(section?.className).toContain("border-border");
    expect(section?.className).toContain("bg-surface");
    expect(section?.textContent).toBe("Contenido");
  });

  it("renderiza el título como h2 y no añade cabecera si no hay título ni acciones", () => {
    mounted = mountComponent(<Panel title="Productos"><p>x</p></Panel>);
    expect(mounted.container.querySelector("h2")?.textContent).toBe("Productos");
    mounted.unmount();

    mounted = mountComponent(<Panel><p>x</p></Panel>);
    expect(mounted.container.querySelector("h2")).toBeNull();
    expect(mounted.container.querySelector("section")?.children).toHaveLength(1);
  });

  it("muestra las acciones en la cabecera aunque no haya título", () => {
    mounted = mountComponent(<Panel actions={<button type="button">Exportar</button>}><p>x</p></Panel>);

    expect(mounted.container.querySelector("h2")).toBeNull();
    expect(mounted.container.querySelector("button")?.textContent).toBe("Exportar");
  });

  it("aplica la clase adicional a la sección", () => {
    mounted = mountComponent(<Panel className="mt-6"><p>x</p></Panel>);

    expect(mounted.container.querySelector("section")?.className).toContain("mt-6");
  });
});
