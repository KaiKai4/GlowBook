// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra un esqueleto decorativo con título, cuatro tarjetas y el bloque de contenido", () => {
    mounted = mountComponent(<DashboardLoading />);

    const skeletons = mounted.container.querySelectorAll('[aria-hidden="true"].animate-pulse');
    expect(skeletons).toHaveLength(7);
    expect(mounted.container.querySelectorAll(".h-28")).toHaveLength(4);
    expect(mounted.container.querySelector(".h-72")).not.toBeNull();
  });

  it("no contiene texto visible para lectores de pantalla", () => {
    mounted = mountComponent(<DashboardLoading />);

    expect(mounted.container.textContent).toBe("");
  });
});
