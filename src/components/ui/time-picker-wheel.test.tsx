// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, pressKey, requireElement } from "@/test/ui-shared-dom";
import { TimePicker } from "./time-picker";

const ITEM_HEIGHT = 36;
const CENTER_COPY = 3;

function stubElementMethods(): void {
  // jsdom no implementa estos métodos de desplazamiento en elementos.
  for (const method of ["scrollTo", "scrollBy"] as const) {
    if (!(method in Element.prototype)) {
      Object.defineProperty(Element.prototype, method, { configurable: true, value: vi.fn() });
    }
  }
}

function wheel(label: "Hora" | "Minutos"): HTMLElement {
  return requireElement<HTMLElement>(document, `[role="listbox"][aria-label="${label}"]`);
}

function scrollWheel(element: HTMLElement, scrollTop: number): void {
  act(() => {
    element.scrollTop = scrollTop;
    element.dispatchEvent(new Event("scroll"));
  });
}

function openPanel(container: HTMLElement): void {
  clickElement(requireElement<HTMLButtonElement>(container, "button[aria-haspopup='dialog']"));
}

describe("TimePicker (rueda de desplazamiento)", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    stubElementMethods();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("las flechas arriba y abajo desplazan la rueda un elemento", () => {
    const scrollBy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollBy", { configurable: true, value: scrollBy });
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" onChange={vi.fn()} />);
    openPanel(mounted.container);

    pressKey(wheel("Minutos"), "ArrowDown");
    pressKey(wheel("Minutos"), "ArrowUp");
    pressKey(wheel("Minutos"), "Enter");

    expect(scrollBy.mock.calls.map((call) => call[0])).toEqual([
      { top: ITEM_HEIGHT, behavior: "smooth" },
      { top: -ITEM_HEIGHT, behavior: "smooth" },
    ]);
  });

  it("al desplazar la rueda de minutos, el minuto centrado queda como selección al guardar", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<TimePicker value="09:00" label="Inicio" onChange={onChange} />);
    openPanel(mounted.container);

    // Minuto 0 está centrado en la copia central; el centro se calcula como round(scrollTop/36) + 2.
    const minutes = wheel("Minutos");
    scrollWheel(minutes, (CENTER_COPY * 60 + 5 - 2) * ITEM_HEIGHT);
    clickElement(findButtonByText(document.body, "Guardar"));

    expect(onChange).toHaveBeenCalledWith("09:05");
  });

  it("tras detenerse cerca del borde de las copias, la rueda se recoloca en la copia central", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<TimePicker value="09:00" label="Inicio" onChange={vi.fn()} />);
    openPanel(mounted.container);

    const hours = wheel("Hora");
    scrollWheel(hours, 0);
    expect(hours.scrollTop).toBe(0);

    act(() => {
      vi.advanceTimersByTime(90);
    });

    // La hora centrada en la copia 0 (valor lógico 3) se recoloca en la copia central.
    const logicalIndex = 2;
    expect(hours.scrollTop).toBe((CENTER_COPY * 12 + logicalIndex - 2) * ITEM_HEIGHT);
  });

  it("si la rueda queda en la copia central no se recoloca", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<TimePicker value="09:00" label="Inicio" onChange={vi.fn()} />);
    openPanel(mounted.container);

    const minutes = wheel("Minutos");
    const centered = (CENTER_COPY * 60 + 10 - 2) * ITEM_HEIGHT;
    scrollWheel(minutes, centered);
    act(() => {
      vi.advanceTimersByTime(90);
    });

    expect(minutes.scrollTop).toBe(centered);
  });
});
