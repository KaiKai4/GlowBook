// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { SegmentedControl } from "./segmented-control";

const OPTIONS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
] as const;

describe("SegmentedControl", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("expone un grupo con nombre y una opción pulsada por valor", () => {
    mounted = mountComponent(
      <SegmentedControl options={OPTIONS} value="semanal" onChange={() => {}} ariaLabel="Vista" />
    );

    const group = mounted.container.querySelector("[role='group']");
    expect(group?.getAttribute("aria-label")).toBe("Vista");

    const buttons = [...mounted.container.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Diaria", "Semanal"]);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
    expect(buttons[1]?.className).toContain("text-brand-700");
  });

  it("notifica el valor de la opción pulsada", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <SegmentedControl options={OPTIONS} value="diaria" onChange={onChange} ariaLabel="Vista" />
    );

    const second = mounted.container.querySelectorAll("button")[1];
    act(() => {
      second?.click();
    });

    expect(onChange).toHaveBeenCalledWith("semanal");
  });

  it("no notifica cambios cuando está deshabilitado", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <SegmentedControl options={OPTIONS} value="diaria" onChange={onChange} disabled ariaLabel="Vista" />
    );

    const buttons = mounted.container.querySelectorAll("button");
    expect([...buttons].every((b) => b.disabled)).toBe(true);
    act(() => {
      buttons[1]?.click();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
