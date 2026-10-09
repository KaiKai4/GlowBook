// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import ReportsLoading from "./loading";

describe("ReportsLoading", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el esqueleto de reportes: encabezado, cuatro indicadores y dos gráficos", () => {
    mounted = mountComponent(<ReportsLoading />);

    expect(mounted.container.querySelectorAll('[aria-hidden="true"].animate-pulse')).toHaveLength(8);
    expect(mounted.container.querySelectorAll(".h-80")).toHaveLength(2);
    expect(mounted.container.querySelectorAll(".h-28")).toHaveLength(4);
  });

  it("no contiene texto visible mientras carga", () => {
    mounted = mountComponent(<ReportsLoading />);

    expect(mounted.container.textContent).toBe("");
  });
});
