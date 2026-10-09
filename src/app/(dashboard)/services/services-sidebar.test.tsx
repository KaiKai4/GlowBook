// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click } from "@/test/ui-people-dom";
import { buildCategory } from "@/test/ui-people-fixtures";
import { ServicesSidebar } from "./services-sidebar";

function rowFor(container: HTMLElement, label: string): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll<HTMLButtonElement>("li > button")).find((button) =>
    button.textContent?.startsWith(label)
  );
  if (!row) throw new Error(`No se encontró la fila "${label}"`);
  return row;
}

describe("ServicesSidebar", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("lista Todas con el total de servicios y cada categoría con su conteo", () => {
    const categories = [
      buildCategory({ id: "cat-1", name: "Cabello" }),
      buildCategory({ id: "cat-2", name: "Uñas", services: [] }),
    ];
    mounted = mountComponent(
      <ServicesSidebar
        categories={categories}
        activeCategoryId="all"
        totalServices={7}
        onSelectCategory={vi.fn()}
        onCreateCategory={vi.fn()}
      />
    );

    const rows = Array.from(mounted.container.querySelectorAll("li")).map((item) => item.textContent);
    expect(rows).toEqual(["Todas7", "Cabello1", "Uñas0"]);
  });

  it("resalta solo la fila de la categoría activa", () => {
    mounted = mountComponent(
      <ServicesSidebar
        categories={[buildCategory({ id: "cat-1", name: "Cabello" }), buildCategory({ id: "cat-2", name: "Uñas" })]}
        activeCategoryId="cat-2"
        totalServices={2}
        onSelectCategory={vi.fn()}
        onCreateCategory={vi.fn()}
      />
    );

    expect(rowFor(mounted.container, "Uñas").className).toContain("font-medium");
    expect(rowFor(mounted.container, "Cabello").className).not.toContain("font-medium");
    expect(rowFor(mounted.container, "Todas").className).not.toContain("font-medium");
  });

  it("selecciona Todas o una categoría concreta según la fila pulsada", () => {
    const onSelectCategory = vi.fn();
    mounted = mountComponent(
      <ServicesSidebar
        categories={[buildCategory({ id: "cat-1", name: "Cabello" })]}
        activeCategoryId="all"
        totalServices={1}
        onSelectCategory={onSelectCategory}
        onCreateCategory={vi.fn()}
      />
    );

    click(rowFor(mounted.container, "Cabello"));
    click(rowFor(mounted.container, "Todas"));

    expect(onSelectCategory.mock.calls).toEqual([["cat-1"], ["all"]]);
  });

  it("abre la creación de categoría desde el enlace Nueva", () => {
    const onCreateCategory = vi.fn();
    mounted = mountComponent(
      <ServicesSidebar
        categories={[]}
        activeCategoryId="all"
        totalServices={0}
        onSelectCategory={vi.fn()}
        onCreateCategory={onCreateCategory}
      />
    );

    click(buttonWithText(mounted.container, "+ Nueva"));

    expect(onCreateCategory).toHaveBeenCalledTimes(1);
  });
});
