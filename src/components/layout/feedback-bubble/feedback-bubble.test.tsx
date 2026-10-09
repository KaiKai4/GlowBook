// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "@/infra/result";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, requireElement, setFieldValue } from "@/test/ui-shared-dom";
import { FeedbackBubble } from "./index";
import type { SubmitFeedbackAction } from "./types";

const STORAGE_KEY = "glowbook.feedbackBubblePosition";
// Dimensiones por defecto de jsdom para calcular la posición esperada.
const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;
const BUBBLE_SIZE = 56;
const PADDING = 24;

function bubble(): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(document, 'button[aria-label="Reportar a soporte"]');
}

function textarea(): HTMLTextAreaElement {
  return requireElement<HTMLTextAreaElement>(document, "textarea");
}

function sendButton(): HTMLButtonElement {
  return findButtonByText(document, "Enviar reporte");
}

// El panel se identifica por su ancho máximo (clase de Tailwind), único en el componente.
function panelText(): string {
  const panel = Array.from(document.querySelectorAll<HTMLElement>("div")).find((element) =>
    element.className.includes("22rem")
  );
  return panel?.textContent ?? "";
}

/** Espera al siguiente frame de animación (el componente posiciona la burbuja en rAF al montar). */
async function waitForFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

async function clickAsync(element: Element): Promise<void> {
  await act(async () => {
    if (element instanceof HTMLElement) element.click();
  });
}

function pointer(element: Element, type: "pointerdown" | "pointermove" | "pointerup", clientX: number, clientY: number) {
  act(() => {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  });
}

describe("FeedbackBubble", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    // jsdom no implementa la captura de puntero que usa el arrastre.
    if (!("setPointerCapture" in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
      Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: vi.fn() });
    }
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  async function mountBubble(submit: SubmitFeedbackAction): Promise<void> {
    mounted = mountComponent(<FeedbackBubble submitFeedbackAction={submit} />);
    await waitForFrame();
  }

  it("aparece tras montar, en la esquina inferior derecha por defecto", async () => {
    await mountBubble(vi.fn<SubmitFeedbackAction>());

    expect(bubble().style.left).toBe(`${VIEWPORT_WIDTH - PADDING - BUBBLE_SIZE}px`);
    expect(bubble().style.top).toBe(`${VIEWPORT_HEIGHT - PADDING - BUBBLE_SIZE}px`);
  });

  it("restaura la posición guardada y la ajusta para que quede dentro del viewport", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: 5000, top: -10 }));
    await mountBubble(vi.fn<SubmitFeedbackAction>());

    expect(bubble().style.left).toBe(`${VIEWPORT_WIDTH - PADDING - BUBBLE_SIZE}px`);
    expect(bubble().style.top).toBe(`${PADDING}px`);
  });

  it("si la posición guardada está corrupta la descarta y usa la posición por defecto", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{no es json");
    await mountBubble(vi.fn<SubmitFeedbackAction>());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(bubble().style.left).toBe(`${VIEWPORT_WIDTH - PADDING - BUBBLE_SIZE}px`);
  });

  it("abre el panel de reporte al pulsar la burbuja y lo cierra al pulsarla de nuevo", async () => {
    await mountBubble(vi.fn<SubmitFeedbackAction>());

    clickElement(bubble());
    expect(textarea()).toBeInstanceOf(HTMLTextAreaElement);
    expect(panelText()).toContain("Reportar a soporte");

    clickElement(bubble());
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("no permite enviar mientras el mensaje tenga menos de 5 caracteres útiles", async () => {
    await mountBubble(vi.fn<SubmitFeedbackAction>());
    clickElement(bubble());

    setFieldValue(textarea(), "  hola ");
    expect(sendButton().disabled).toBe(true);

    setFieldValue(textarea(), "hola!");
    expect(sendButton().disabled).toBe(false);
  });

  it("envía la categoría elegida y el mensaje, y muestra la confirmación al terminar", async () => {
    const submit = vi.fn<SubmitFeedbackAction>(async () => ok(undefined));
    await mountBubble(submit);
    clickElement(bubble());

    clickElement(findButtonByText(document, "Sugerencia"));
    setFieldValue(textarea(), "Agregar exportar a PDF");
    await clickAsync(sendButton());

    expect(submit).toHaveBeenCalledWith({ category: "suggestion", message: "Agregar exportar a PDF" });
    expect(panelText()).toContain("Reporte enviado");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("por defecto envía la categoría Falla / Error", async () => {
    const submit = vi.fn<SubmitFeedbackAction>(async () => ok(undefined));
    await mountBubble(submit);
    clickElement(bubble());
    setFieldValue(textarea(), "La agenda no carga");

    await clickAsync(sendButton());

    expect(submit).toHaveBeenCalledWith({ category: "bug", message: "La agenda no carga" });
  });

  it("si el envío falla muestra el motivo y lo limpia al volver a escribir", async () => {
    const submit = vi.fn<SubmitFeedbackAction>(async () => err("Describe mejor el problema"));
    await mountBubble(submit);
    clickElement(bubble());
    setFieldValue(textarea(), "No funciona nada");

    await clickAsync(sendButton());

    expect(panelText()).toContain("Describe mejor el problema");
    expect(panelText()).not.toContain("Reporte enviado");

    setFieldValue(textarea(), "No funciona nada de nada");
    expect(panelText()).not.toContain("Describe mejor el problema");
  });

  it("durante el envío el botón muestra el estado de espera y no permite reenviar", async () => {
    let resolveSubmit: (value: Result<void>) => void = () => undefined;
    const submit = vi.fn<SubmitFeedbackAction>(
      () => new Promise<Result<void>>((resolve) => (resolveSubmit = resolve))
    );
    await mountBubble(submit);
    clickElement(bubble());
    setFieldValue(textarea(), "Mensaje suficiente");

    act(() => {
      sendButton().click();
    });

    expect(findButtonByText(document, "Enviando...").disabled).toBe(true);

    await act(async () => {
      resolveSubmit(ok(undefined));
    });
    expect(panelText()).toContain("Reporte enviado");
  });

  it("el botón Listo de la confirmación cierra el panel", async () => {
    await mountBubble(vi.fn<SubmitFeedbackAction>(async () => ok(undefined)));
    clickElement(bubble());
    setFieldValue(textarea(), "Mensaje suficiente");
    await clickAsync(sendButton());

    clickElement(findButtonByText(document, "Listo"));

    expect(document.querySelector("textarea")).toBeNull();
    expect(panelText()).toBe("");
  });

  it("arrastrar la burbuja la mueve, guarda la nueva posición y no abre el panel al soltar", async () => {
    await mountBubble(vi.fn<SubmitFeedbackAction>());
    const start = { left: VIEWPORT_WIDTH - PADDING - BUBBLE_SIZE, top: VIEWPORT_HEIGHT - PADDING - BUBBLE_SIZE };

    pointer(bubble(), "pointerdown", 900, 650);
    pointer(bubble(), "pointermove", 800, 600);
    pointer(bubble(), "pointerup", 800, 600);
    clickElement(bubble());

    expect(bubble().style.left).toBe(`${start.left - 100}px`);
    expect(bubble().style.top).toBe(`${start.top - 50}px`);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      left: start.left - 100,
      top: start.top - 50,
    });
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("un clic sin arrastre sigue abriendo el panel", async () => {
    await mountBubble(vi.fn<SubmitFeedbackAction>());

    pointer(bubble(), "pointerdown", 900, 650);
    pointer(bubble(), "pointerup", 900, 650);
    clickElement(bubble());

    expect(document.querySelector("textarea")).not.toBeNull();
  });
});
