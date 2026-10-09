// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("compone encabezado, título, descripción y contenido dentro de la tarjeta", () => {
    mounted = mountComponent(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Ingresos</CardTitle>
          <CardDescription>Mes actual</CardDescription>
        </CardHeader>
        <CardContent>1.200 USD</CardContent>
      </Card>
    );

    const card = mounted.container.querySelector<HTMLElement>('[data-testid="card"]');
    expect(card?.className).toContain("rounded-xl");
    expect(card?.querySelector("h3")?.textContent).toBe("Ingresos");
    expect(card?.querySelector("p")?.textContent).toBe("Mes actual");
    expect(card?.textContent).toContain("1.200 USD");
  });

  it("CardTitle usa un h3 y CardDescription un párrafo", () => {
    mounted = mountComponent(
      <>
        <CardTitle>Título</CardTitle>
        <CardDescription>Texto</CardDescription>
      </>
    );

    expect(mounted.container.querySelector("h3")?.textContent).toBe("Título");
    expect(mounted.container.querySelector("p")?.textContent).toBe("Texto");
  });

  it("cada parte acepta className adicional y conserva sus clases base cuando no hay conflicto", () => {
    mounted = mountComponent(
      <>
        <CardHeader className="gap-4" data-testid="header" />
        <CardContent className="p-2" data-testid="content" />
        <CardTitle className="text-lg" data-testid="title">T</CardTitle>
        <CardDescription className="italic" data-testid="desc">D</CardDescription>
      </>
    );

    const header = mounted.container.querySelector<HTMLElement>('[data-testid="header"]');
    const content = mounted.container.querySelector<HTMLElement>('[data-testid="content"]');
    const title = mounted.container.querySelector<HTMLElement>('[data-testid="title"]');
    const desc = mounted.container.querySelector<HTMLElement>('[data-testid="desc"]');

    expect(header?.className).toContain("flex-col");
    expect(header?.className).toContain("gap-4");
    expect(content?.className).toContain("p-2");
    expect(content?.className).not.toContain("p-6");
    expect(title?.className).toContain("font-semibold");
    expect(title?.className).toContain("text-lg");
    expect(desc?.className).toContain("text-fg-subtle");
    expect(desc?.className).toContain("italic");
  });
});
