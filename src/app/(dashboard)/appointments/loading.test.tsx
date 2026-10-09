// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import AppointmentsLoading from "./loading";

describe("AppointmentsLoading", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra esqueletos del encabezado y de la grilla mientras carga la agenda", () => {
    mounted = mountComponent(<AppointmentsLoading />);

    // 5 del encabezado (título, subtítulo y tres controles) + 5 de días + 20 de franjas.
    expect(mounted.container.querySelectorAll(".animate-pulse")).toHaveLength(30);
  });

  it("no expone controles interactivos durante la carga", () => {
    mounted = mountComponent(<AppointmentsLoading />);

    expect(mounted.container.querySelectorAll("button, a, input")).toHaveLength(0);
  });
});
