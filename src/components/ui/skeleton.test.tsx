// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("es decorativo: queda oculto para lectores de pantalla y anima el pulso", () => {
    mounted = mountComponent(<Skeleton />);

    const element = mounted.container.firstElementChild;
    expect(element?.getAttribute("aria-hidden")).toBe("true");
    expect(element?.className).toContain("animate-pulse");
    expect(element?.textContent).toBe("");
  });

  it("acepta dimensiones personalizadas mediante className", () => {
    mounted = mountComponent(<Skeleton className="h-8 w-48" />);

    const element = mounted.container.firstElementChild;
    expect(element?.className).toContain("h-8");
    expect(element?.className).toContain("w-48");
    expect(element?.className).toContain("rounded-lg");
  });
});
