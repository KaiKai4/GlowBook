// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { AppointmentStepper } from "./appointment-stepper";

const STEPS = ["Cliente", "Servicios", "Confirmar"] as const;

/** Etiqueta de cada paso: el segundo <p> de cada bloque contiene el nombre del paso. */
function stepLabels(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("p.text-sm.font-semibold"));
}

/** Bloque de cada paso (el contenedor que lleva aria-current cuando el paso está activo). */
function stepBlocks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(":scope > div > div"));
}

/** Círculo numerado de cada paso. */
function stepCircles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".h-9.w-9"));
}

describe("AppointmentStepper", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("marca el paso actual como activo, los anteriores como completados y los siguientes como pendientes", () => {
    mounted = mountComponent(<AppointmentStepper steps={STEPS} currentStep={2} />);

    const labels = stepLabels(mounted.container);
    expect(labels.map((label) => label.textContent)).toEqual(["Cliente", "Servicios", "Confirmar"]);
    expect(labels[0]?.className).toContain("text-fg-subtle");
    expect(labels[1]?.className).toContain("text-fg");
    expect(labels[2]?.className).toContain("text-fg-subtle");
  });

  it("muestra el primer paso como activo cuando todavía no hay ninguno completado", () => {
    mounted = mountComponent(<AppointmentStepper steps={STEPS} currentStep={1} />);

    const numbers = stepCircles(mounted.container);
    expect(numbers[0]?.className).toContain("bg-brand-600");
    expect(numbers[0]?.className).not.toContain("bg-success");
  });

  it("comunica el paso completado con icono y texto accesible, no solo con color", () => {
    mounted = mountComponent(<AppointmentStepper steps={STEPS} currentStep={3} />);

    const circles = stepCircles(mounted.container);
    expect(circles[0]?.textContent).toBe("Completado");
    expect(circles[0]?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(circles[1]?.textContent).toBe("Completado");
    expect(circles[2]?.textContent).toBe("3");
    expect(circles[2]?.querySelector("svg")).toBeNull();
  });

  it("marca únicamente el paso actual con aria-current=\"step\"", () => {
    mounted = mountComponent(<AppointmentStepper steps={STEPS} currentStep={2} />);

    const blocks = stepBlocks(mounted.container);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.hasAttribute("aria-current")).toBe(false);
    expect(blocks[1]?.getAttribute("aria-current")).toBe("step");
    expect(blocks[2]?.hasAttribute("aria-current")).toBe(false);
  });
});
