// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { TimePicker } from "./time-picker";

// Cada ítem mide 36px. La rueda de horas tiene 12 valores y 7 copias: el
// centro lógico se calcula como round(scrollTop / 36) + 2 y después módulo 12.
// Con 10:00 la posición inicial es 43 (índice lógico 9). Con scrollTop = 12 * 36
// el centro cae en el índice lógico 2, que es la hora 3.
const ITEM_HEIGHT = 36;

function openPicker(container: HTMLElement) {
  const trigger = container.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']");
  if (!trigger) throw new Error("Falta el disparador del selector de hora");
  act(() => {
    trigger.click();
  });
}

function wheels(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"]'));
}

function centeredOption(wheel: HTMLElement): string | null {
  return wheel.querySelector('[role="option"][aria-selected="true"]')?.textContent ?? null;
}

describe("TimePicker", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra la hora seleccionada en el disparador y el valor oculto del formulario", () => {
    mounted = mountComponent(<TimePicker value="14:30" name="start_time" label="Hora de inicio" />);

    expect(mounted.container.textContent).toMatch(/2:30\D+p/);
    const hidden = mounted.container.querySelector<HTMLInputElement>('input[name="start_time"]');
    expect(hidden?.value).toBe("14:30");
  });

  it("al desplazar la rueda de horas, la hora centrada pasa a ser la nueva selección", () => {
    mounted = mountComponent(<TimePicker value="10:00" label="Hora de inicio" />);
    openPicker(mounted.container);

    const hourWheel = wheels()[0];
    if (!hourWheel) throw new Error("Falta la rueda de horas");
    expect(centeredOption(hourWheel)).toBe("10");

    act(() => {
      hourWheel.scrollTop = 12 * ITEM_HEIGHT;
      hourWheel.dispatchEvent(new Event("scroll"));
    });

    expect(centeredOption(hourWheel)).toBe("03");
  });

  it("no cambia la selección cuando la rueda queda en el mismo valor", () => {
    mounted = mountComponent(<TimePicker value="10:00" label="Hora de inicio" />);
    openPicker(mounted.container);

    const hourWheel = wheels()[0];
    if (!hourWheel) throw new Error("Falta la rueda de horas");
    act(() => {
      hourWheel.scrollTop = 43 * ITEM_HEIGHT;
      hourWheel.dispatchEvent(new Event("scroll"));
    });

    expect(centeredOption(hourWheel)).toBe("10");
  });
});
