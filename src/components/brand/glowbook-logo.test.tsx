// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { GlowBookBrand } from "./glowbook-logo";

describe("GlowBookBrand (variantes de color y alineación)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("en modo oscuro el nombre usa el color de superficie para contrastar", () => {
    mounted = mountComponent(<GlowBookBrand dark />);

    const name = mounted.container.querySelector("p");
    expect(name?.textContent).toBe("GlowBook");
    expect(name?.className).toContain("text-surface");
    expect(name?.className).not.toContain("text-fg-strong");
  });

  it("en modo claro por defecto el nombre usa el color de texto fuerte", () => {
    mounted = mountComponent(<GlowBookBrand />);

    const name = mounted.container.querySelector("p");
    expect(name?.className).toContain("text-fg-strong");
    expect(name?.className).not.toContain("text-surface");
  });

  it("alineado a la izquierda no centra el bloque", () => {
    mounted = mountComponent(<GlowBookBrand align="left" />);

    const block = mounted.container.firstElementChild;
    expect(block?.className).toContain("items-start");
    expect(block?.className).not.toContain("items-center");
  });
});
