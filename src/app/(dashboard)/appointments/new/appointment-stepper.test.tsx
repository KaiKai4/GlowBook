// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { AppointmentStepper } from "./appointment-stepper";

const STEPS = ["Cliente", "Servicios", "Confirmar"] as const;

/** Etiqueta de cada paso: el segundo <p> de cada bloque contiene el nombre del paso. */
function stepLabels(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("p.text-sm.font-semibold"));
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

    const numbers = Array.from(mounted.container.querySelectorAll<HTMLElement>(".rounded-full"));
    expect(numbers[0]?.className).toContain("bg-brand-600");
    expect(numbers[0]?.className).not.toContain("bg-success");
  });
});
