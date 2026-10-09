// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click } from "@/test/ui-people-dom";
import { ServicesStats } from "./services-stats";

describe("ServicesStats", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el título y las métricas de categorías y servicios con sus inactivos", () => {
    mounted = mountComponent(
      <ServicesStats
        categoryCount={3}
        serviceCount={12}
        inactiveServiceCount={2}
        canCreateService
        onCreateService={vi.fn()}
      />
    );

    expect(mounted.container.querySelector("h1")?.textContent).toBe("Servicios");
    expect(mounted.container.textContent).toContain("categorías");
    expect(mounted.container.textContent).toContain("servicios");
    expect(mounted.container.textContent).toContain("2 inact.");
    expect(mounted.container.textContent).toContain("12");
  });

  it("invoca onCreateService al pulsar Nuevo servicio cuando está permitido", () => {
    const onCreateService = vi.fn();
    mounted = mountComponent(
      <ServicesStats
        categoryCount={1}
        serviceCount={0}
        inactiveServiceCount={0}
        canCreateService
        onCreateService={onCreateService}
      />
    );

    click(buttonWithText(mounted.container, "Nuevo servicio"));

    expect(onCreateService).toHaveBeenCalledTimes(1);
  });

  it("deshabilita Nuevo servicio y no lo invoca cuando no hay categorías", () => {
    const onCreateService = vi.fn();
    mounted = mountComponent(
      <ServicesStats
        categoryCount={0}
        serviceCount={0}
        inactiveServiceCount={0}
        canCreateService={false}
        onCreateService={onCreateService}
      />
    );

    const button = buttonWithText(mounted.container, "Nuevo servicio");
    expect(button.disabled).toBe(true);
    click(button);

    expect(onCreateService).not.toHaveBeenCalled();
  });
});
