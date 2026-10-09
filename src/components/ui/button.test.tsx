// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement } from "@/test/ui-shared-dom";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function buttonElement(): HTMLButtonElement {
    const element = mounted?.container.querySelector<HTMLButtonElement>("button");
    if (!element) throw new Error("Falta el botón");
    return element;
  }

  it("usa la variante default y el tamaño md cuando no se indican", () => {
    mounted = mountComponent(<Button>Guardar</Button>);

    expect(buttonElement().className).toContain("bg-fg");
    expect(buttonElement().className).toContain("h-10");
  });

  it("aplica la variante y el tamaño indicados", () => {
    mounted = mountComponent(
      <Button variant="destructive" size="sm">
        Eliminar
      </Button>
    );

    expect(buttonElement().className).toContain("bg-danger");
    expect(buttonElement().className).toContain("h-8");
    expect(buttonElement().className).not.toContain("h-10");
  });

  it("ejecuta onClick al pulsarlo", () => {
    const onClick = vi.fn();
    mounted = mountComponent(<Button onClick={onClick}>Abrir</Button>);

    clickElement(buttonElement());

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("no ejecuta onClick cuando está deshabilitado", () => {
    const onClick = vi.fn();
    mounted = mountComponent(
      <Button disabled onClick={onClick}>
        Abrir
      </Button>
    );

    clickElement(buttonElement());

    expect(buttonElement().disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("en estado loading se deshabilita, muestra el spinner y conserva el texto", () => {
    const onClick = vi.fn();
    mounted = mountComponent(
      <Button loading onClick={onClick}>
        Enviando
      </Button>
    );

    expect(buttonElement().disabled).toBe(true);
    expect(buttonElement().querySelector("svg.animate-spin")).not.toBeNull();
    expect(buttonElement().textContent).toBe("Enviando");
    clickElement(buttonElement());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("sin loading no muestra spinner", () => {
    mounted = mountComponent(<Button>Listo</Button>);

    expect(buttonElement().querySelector("svg")).toBeNull();
  });

  it("reenvía la ref al elemento button nativo", () => {
    const ref = createRef<HTMLButtonElement>();
    mounted = mountComponent(<Button ref={ref}>Ref</Button>);

    expect(ref.current).toBe(buttonElement());
  });

  it("buttonVariants construye las clases de la variante y el tamaño pedidos", () => {
    expect(buttonVariants({ variant: "outline", size: "lg" })).toContain("border-border");
    expect(buttonVariants({ variant: "outline", size: "lg" })).toContain("h-11");
    expect(buttonVariants({ variant: "ghost" })).toContain("text-fg-muted");
    expect(buttonVariants({ variant: "ghost" })).toContain("h-10");
  });

  it("combina className con las clases de variante y gana en conflictos", () => {
    mounted = mountComponent(<Button className="h-20">Alto</Button>);

    expect(buttonElement().className).toContain("h-20");
    expect(buttonElement().className).not.toContain("h-10");
  });
});
