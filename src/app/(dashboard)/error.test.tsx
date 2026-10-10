// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText } from "@/test/ui-shared-dom";
import DashboardError from "./error";

describe("DashboardError", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("explica que la sección no cargó y ofrece reintentar", () => {
    mounted = mountComponent(<DashboardError error={new Error("boom")} retry={vi.fn()} />);

    expect(mounted.container.querySelector("h2")?.textContent).toBe("No se pudo cargar esta sección");
    expect(mounted.container.textContent).toContain("Intenta nuevamente.");
    expect(findButtonByText(mounted.container, "Reintentar").type).toBe("button");
  });

  it("el botón Reintentar invoca la función de reintento de Next.js", () => {
    const retry = vi.fn();
    mounted = mountComponent(<DashboardError error={new Error("boom")} retry={retry} />);

    clickElement(findButtonByText(mounted.container, "Reintentar"));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("no expone el mensaje técnico del error al usuario", () => {
    mounted = mountComponent(
      <DashboardError error={new Error("relation secret_table does not exist")} retry={vi.fn()} />
    );

    expect(mounted.container.textContent).not.toContain("secret_table");
  });
});
