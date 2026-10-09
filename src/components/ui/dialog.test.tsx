// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, pressKey } from "@/test/ui-shared-dom";
import { Dialog } from "./dialog";

describe("Dialog", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.style.overflow = "";
  });

  function dialogElement(): HTMLElement {
    const element = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!element) throw new Error("No hay diálogo abierto");
    return element;
  }

  it("no renderiza nada cuando está cerrado", () => {
    mounted = mountComponent(
      <Dialog open={false} onClose={vi.fn()} title="Confirmar">
        Contenido
      </Dialog>
    );

    expect(mounted.container.textContent).toBe("");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("expone un diálogo modal etiquetado por su título y su descripción", () => {
    mounted = mountComponent(
      <Dialog open onClose={vi.fn()} title="Eliminar cita" description="Esta acción no se puede deshacer">
        <p>Cuerpo</p>
      </Dialog>
    );

    const dialog = dialogElement();
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(labelledBy ? document.getElementById(labelledBy)?.textContent : null).toBe("Eliminar cita");
    expect(describedBy ? document.getElementById(describedBy)?.textContent : null).toBe(
      "Esta acción no se puede deshacer"
    );
    expect(dialog.textContent).toContain("Cuerpo");
  });

  it("sin descripción no declara aria-describedby", () => {
    mounted = mountComponent(
      <Dialog open onClose={vi.fn()} title="Aviso">
        Texto
      </Dialog>
    );

    expect(dialogElement().hasAttribute("aria-describedby")).toBe(false);
  });

  it("el botón Cerrar invoca onClose", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Dialog open onClose={onClose} title="Aviso">
        Texto
      </Dialog>
    );

    const closeButton = document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]');
    if (!closeButton) throw new Error("Falta el botón Cerrar");
    clickElement(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("al pulsar Escape se cierra, pero otras teclas no", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Dialog open onClose={onClose} title="Aviso">
        Texto
      </Dialog>
    );

    pressKey(document.body, "Enter");
    expect(onClose).not.toHaveBeenCalled();

    pressKey(document.body, "Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hacer clic en el velo de fondo cierra el diálogo", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Dialog open onClose={onClose} title="Aviso">
        Texto
      </Dialog>
    );

    const overlay = mounted.container.querySelector<HTMLElement>('[aria-hidden="true"]');
    if (!overlay) throw new Error("Falta el velo");
    clickElement(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("bloquea el scroll del body mientras está abierto y lo libera al desmontar", () => {
    mounted = mountComponent(
      <Dialog open onClose={vi.fn()} title="Aviso">
        Texto
      </Dialog>
    );
    expect(document.body.style.overflow).toBe("hidden");

    mounted.unmount();
    mounted = null;
    expect(document.body.style.overflow).toBe("");
  });

  it("aplica className al panel del diálogo", () => {
    mounted = mountComponent(
      <Dialog open onClose={vi.fn()} title="Aviso" className="max-w-sm">
        Texto
      </Dialog>
    );

    expect(dialogElement().className).toContain("max-w-sm");
    // twMerge resuelve el conflicto de ancho máximo a favor de className.
    expect(dialogElement().className).not.toContain("max-w-md");
    expect(dialogElement().className).toContain("rounded-2xl");
  });
});
