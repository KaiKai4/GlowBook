// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement } from "@/test/ui-shared-dom";
import { Dialog } from "./dialog";

// Harness: abre y cierra el diálogo desde un botón externo, como en la app real.
function Harness({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar">
        <input aria-label="Nombre" />
        <button type="button">Guardar</button>
      </Dialog>
    </>
  );
}

function must<T>(value: T | null | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

function dialogPanel(): HTMLElement {
  return must(document.querySelector<HTMLElement>('[role="dialog"]'), "No hay diálogo abierto");
}

function keydown(target: Element, key: string, options: { shiftKey?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, shiftKey: options.shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("Dialog: gestión del foco", () => {
  let mounted: MountedComponent | null = null;
  let outside: HTMLElement | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    outside?.remove();
    outside = null;
    document.body.style.overflow = "";
  });

  it("al abrir, el foco va al primer elemento enfocable del diálogo", () => {
    mounted = mountComponent(<Harness />);
    clickElement(must(document.querySelector<HTMLButtonElement>("button"), "Falta el botón Abrir"));

    // El primer enfocable es el botón Cerrar del encabezado.
    expect(document.activeElement).toBe(must(document.querySelector('button[aria-label="Cerrar"]'), "Falta Cerrar"));
  });

  it("Tab desde el último elemento vuelve al primero, y Shift+Tab desde el primero va al último", () => {
    mounted = mountComponent(<Harness initiallyOpen />);
    const panel = dialogPanel();
    const first = must(panel.querySelector<HTMLElement>('button[aria-label="Cerrar"]'), "Falta Cerrar");
    const last = must(
      Array.from(panel.querySelectorAll<HTMLElement>("button")).at(-1),
      "Falta el último botón"
    );

    last.focus();
    const forward = keydown(last, "Tab");
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const backward = keydown(first, "Tab", { shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("un foco que sale del diálogo vuelve a entrar", () => {
    mounted = mountComponent(<Harness initiallyOpen />);
    outside = document.createElement("button");
    document.body.appendChild(outside);

    outside.focus();

    expect(dialogPanel().contains(document.activeElement)).toBe(true);
  });

  it("al cerrar, el foco vuelve al botón que abrió el diálogo", () => {
    mounted = mountComponent(<Harness />);
    const opener = must(document.querySelector<HTMLButtonElement>("button"), "Falta el botón Abrir");
    opener.focus();
    clickElement(opener);
    expect(dialogPanel()).toBeTruthy();

    clickElement(must(document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]'), "Falta Cerrar"));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("con dos diálogos apilados, el foco se queda en el superior sin rebotar", () => {
    mounted = mountComponent(
      <>
        <Dialog open onClose={vi.fn()} title="Formulario">
          <button type="button">Campo</button>
        </Dialog>
        <Dialog open onClose={vi.fn()} title="Confirmar">
          <button type="button">Confirmar acción</button>
        </Dialog>
      </>
    );
    const confirm = must(
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Confirmar acción"
      ),
      "Falta el botón de confirmación"
    );

    act(() => {
      confirm.focus();
    });

    expect(document.activeElement).toBe(confirm);
  });

  it("un Escape ya consumido (defaultPrevented) no cierra el diálogo", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Dialog open onClose={onClose} title="Aviso">
        Texto
      </Dialog>
    );
    // Un popover abierto dentro del diálogo consume el Escape en captura, antes que el diálogo.
    const consume = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", consume, true);

    keydown(document.body, "Escape");
    document.removeEventListener("keydown", consume, true);

    expect(onClose).not.toHaveBeenCalled();
  });
});
