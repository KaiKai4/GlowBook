// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, useRef, useState } from "react";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, pressKey } from "@/test/ui-shared-dom";
import { Popover, popoverTriggerAria } from "./popover";

function pointerDown(target: Element) {
  act(() => {
    target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  });
}

function must<T>(value: T | null | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

// Posición calculada con un disparador de rectángulo conocido (viewport de jsdom: 1024x768).
describe("posición del panel", () => {
  let trigger: HTMLButtonElement | null = null;
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    trigger?.remove();
    trigger = null;
  });

  function placeAt(rect: { top: number; bottom: number; left: number; width: number }) {
    trigger = document.createElement("button");
    document.body.appendChild(trigger);
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ ...rect, right: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });
    const panelRef = { current: trigger };
    return mountComponent(
      <Popover open onDismiss={vi.fn()} triggerRef={panelRef} panelId="pos" width={300} height={200} gap={8}>
        <span>Contenido</span>
      </Popover>
    );
  }

  function panelStyle(): CSSStyleDeclaration {
    return must(document.querySelector<HTMLElement>("[data-popover-panel]"), "Falta el panel").style;
  }

  it("se coloca debajo del disparador cuando cabe", () => {
    mounted = placeAt({ top: 100, bottom: 140, left: 200, width: 150 });

    expect(panelStyle().top).toBe("148px");
    expect(panelStyle().left).toBe("200px");
    expect(panelStyle().width).toBe("300px");
  });

  it("se coloca encima cuando no cabe debajo y el disparador está lejos del borde superior", () => {
    mounted = placeAt({ top: 600, bottom: 640, left: 200, width: 150 });

    expect(panelStyle().top).toBe("392px");
  });

  it("no sale por la izquierda ni por la derecha del viewport", () => {
    mounted = placeAt({ top: 100, bottom: 140, left: -50, width: 80 });
    expect(panelStyle().left).toBe("12px");
    mounted.unmount();
    mounted = null;
    trigger?.remove();
    trigger = null;

    mounted = placeAt({ top: 100, bottom: 140, left: 990, width: 80 });
    expect(panelStyle().left).toBe("712px");
  });
});

describe("popoverTriggerAria", () => {
  it("aria-controls solo apunta al panel mientras está abierto", () => {
    expect(popoverTriggerAria(false, "p1")["aria-controls"]).toBeUndefined();
    expect(popoverTriggerAria(true, "p1")).toEqual({
      "aria-haspopup": "dialog",
      "aria-expanded": true,
      "aria-controls": "p1",
    });
  });
});

function Harness({ focusOnOpen = true }: { focusOnOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        {...popoverTriggerAria(open, "panel-test")}
        onClick={() => setOpen((current) => !current)}
      >
        Disparador
      </button>
      <Popover
        open={open}
        onDismiss={() => setOpen(false)}
        triggerRef={triggerRef}
        panelId="panel-test"
        label="Opciones"
        height={120}
        focusOnOpen={focusOnOpen}
      >
        <button type="button" onClick={() => setOpen(false)}>
          Primera
        </button>
      </Popover>
    </>
  );
}

describe("Popover", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function trigger(): HTMLButtonElement {
    const element = document.querySelector<HTMLButtonElement>("button");
    if (!element) throw new Error("Falta el disparador");
    return element;
  }

  function panel(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-popover-panel]');
  }

  it("al abrir expone el panel con su nombre y aria-controls, y mueve el foco dentro", () => {
    mounted = mountComponent(<Harness />);
    clickElement(trigger());

    expect(panel()?.getAttribute("role")).toBe("dialog");
    expect(panel()?.getAttribute("aria-label")).toBe("Opciones");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe("panel-test");
    expect(panel()?.contains(document.activeElement)).toBe(true);
  });

  it("un clic fuera cierra el panel sin robar el foco de otro control", () => {
    mounted = mountComponent(<Harness />);
    clickElement(trigger());
    const other = document.createElement("input");
    document.body.appendChild(other);

    pointerDown(other);
    act(() => {
      other.focus();
    });

    expect(panel()).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("Escape cierra el panel y devuelve el foco al disparador", () => {
    mounted = mountComponent(<Harness />);
    clickElement(trigger());

    pressKey(document.body, "Escape");

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("si el foco estaba dentro del panel al cerrarse, vuelve al disparador", () => {
    mounted = mountComponent(<Harness />);
    clickElement(trigger());
    const option = must(panel()?.querySelector<HTMLElement>("button"), "Falta la opción");
    act(() => {
      option.focus();
    });

    // La opción cierra el panel: al desmontarse, el foco que tenía se perdería.
    clickElement(option);

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("con focusOnOpen=false el foco se queda en el disparador (listbox con teclado)", () => {
    mounted = mountComponent(<Harness focusOnOpen={false} />);
    trigger().focus();
    clickElement(trigger());

    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("un pointerdown dentro del propio panel no cuenta como clic fuera", () => {
    mounted = mountComponent(<Harness />);
    clickElement(trigger());

    pointerDown(must(panel(), "Falta el panel"));

    expect(panel()).not.toBeNull();
  });
});
