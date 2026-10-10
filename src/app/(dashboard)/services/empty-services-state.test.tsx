// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click } from "@/test/ui-people-dom";
import { EmptyServicesState } from "./empty-services-state";

describe("EmptyServicesState", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("invita a crear la primera categoría", () => {
    mounted = mountComponent(<EmptyServicesState onCreateCategory={vi.fn()} />);

    expect(mounted.container.textContent).toContain("Crea tu primera categoría para empezar.");
  });

  it("invoca onCreateCategory al pulsar Nueva categoría", () => {
    const onCreateCategory = vi.fn();
    mounted = mountComponent(<EmptyServicesState onCreateCategory={onCreateCategory} />);

    click(buttonWithText(mounted.container, "Nueva categoría"));

    expect(onCreateCategory).toHaveBeenCalledTimes(1);
  });
});
