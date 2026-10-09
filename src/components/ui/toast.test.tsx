// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement } from "@/test/ui-shared-dom";
import { ToastProvider, useToast } from "./toast";

function ToastTrigger() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.success("Cita guardada")}>
        ok
      </button>
      <button type="button" onClick={() => toast.error("No se pudo guardar")}>
        fail
      </button>
      <button type="button" onClick={() => toast.info("Cambios pendientes")}>
        info
      </button>
    </>
  );
}

function statusMessages(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="status"]'));
}

function triggerButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent === label
  );
  if (!button) throw new Error(`Falta el disparador ${label}`);
  return button;
}

describe("Toast", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("useToast lanza un error explícito fuera de ToastProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => {
      mounted = mountComponent(<ToastTrigger />);
    }).toThrow("useToast debe usarse dentro de <ToastProvider>.");
  });

  it("muestra el aviso de éxito con su mensaje dentro de una región viva", () => {
    mounted = mountComponent(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    clickElement(triggerButton("ok"));

    const messages = statusMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]?.textContent).toContain("Cita guardada");
    expect(messages[0]?.className).toContain("bg-success-subtle");
    expect(messages[0]?.parentElement?.getAttribute("aria-live")).toBe("polite");
  });

  it("los avisos de error e información usan sus estilos propios", () => {
    mounted = mountComponent(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    clickElement(triggerButton("fail"));
    clickElement(triggerButton("info"));

    const [errorToast, infoToast] = statusMessages();
    expect(errorToast?.textContent).toContain("No se pudo guardar");
    expect(errorToast?.className).toContain("bg-danger-subtle");
    expect(infoToast?.textContent).toContain("Cambios pendientes");
    expect(infoToast?.className).toContain("bg-brand-50");
  });

  it("varios avisos se apilan en el orden en que se generan", () => {
    mounted = mountComponent(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    clickElement(triggerButton("ok"));
    clickElement(triggerButton("fail"));

    expect(statusMessages().map((element) => element.textContent?.trim())).toEqual([
      expect.stringContaining("Cita guardada"),
      expect.stringContaining("No se pudo guardar"),
    ]);
  });

  it("cada aviso desaparece automáticamente a los 4 segundos", () => {
    mounted = mountComponent(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    clickElement(triggerButton("ok"));
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(statusMessages()).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(statusMessages()).toHaveLength(0);
  });

  it("el botón Cerrar aviso retira solo ese aviso", () => {
    mounted = mountComponent(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    clickElement(triggerButton("ok"));
    clickElement(triggerButton("fail"));

    const dismissButtons = document.querySelectorAll<HTMLButtonElement>('button[aria-label="Cerrar aviso"]');
    const firstDismiss = dismissButtons[0];
    if (!firstDismiss) throw new Error("Falta el botón de cierre");
    clickElement(firstDismiss);

    const remaining = statusMessages();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.textContent).toContain("No se pudo guardar");
  });

  it("sin avisos la región permanece vacía", () => {
    mounted = mountComponent(
      <ToastProvider>
        <p>Contenido</p>
      </ToastProvider>
    );

    expect(statusMessages()).toHaveLength(0);
    expect(mounted.container.textContent).toContain("Contenido");
  });
});
