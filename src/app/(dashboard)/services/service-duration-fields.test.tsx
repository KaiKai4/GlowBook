// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { ServiceDurationFields } from "./service-duration-fields";

function durationInputs(container: HTMLElement) {
  const hours = container.querySelector<HTMLInputElement>('input[name="duration_hours"]');
  const minutes = container.querySelector<HTMLInputElement>('input[name="duration_minutes_part"]');
  if (!hours || !minutes) throw new Error("faltan los campos de duración");
  return { hours, minutes };
}

describe("ServiceDurationFields", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("usa 30 minutos por defecto, desglosados en 0 horas y 30 minutos", () => {
    mounted = mountComponent(<ServiceDurationFields />);

    const { hours, minutes } = durationInputs(mounted.container);
    expect(hours.value).toBe("0");
    expect(minutes.value).toBe("30");
  });

  it("desglosa una duración total en horas y minutos", () => {
    mounted = mountComponent(<ServiceDurationFields defaultValue={110} />);

    const { hours, minutes } = durationInputs(mounted.container);
    expect(hours.value).toBe("1");
    expect(minutes.value).toBe("50");
  });

  it("marca ambos campos como obligatorios con los límites de horas y minutos", () => {
    mounted = mountComponent(<ServiceDurationFields defaultValue={60} />);

    const { hours, minutes } = durationInputs(mounted.container);
    expect(hours.required).toBe(true);
    expect(minutes.required).toBe(true);
    expect(hours.min).toBe("0");
    expect(minutes.min).toBe("0");
    expect(minutes.max).toBe("59");
  });

  it("explica el formato de minutos al usuario", () => {
    mounted = mountComponent(<ServiceDurationFields />);

    expect(mounted.container.textContent).toContain("Usa minutos entre 0 y 59. Ejemplo: 1 hora y 50 minutos.");
  });
});
