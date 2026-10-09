// Utilidades de interacción para tests de componentes en jsdom.
// Sin dependencias: simulan eventos nativos que React escucha (input, click, keydown).
import { act } from "react";

/** Escribe un valor en un input o textarea y dispara el evento `input` que React usa para onChange. */
export function setFieldValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("No se encontró el setter nativo de value");
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Dispara un click dentro de act para que React procese el evento. */
export function clickElement(element: Element): void {
  act(() => {
    if (element instanceof HTMLElement) element.click();
    else element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Dispara un keydown (con burbujeo) sobre el elemento indicado. */
export function pressKey(element: Element, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

/** Busca un botón por su texto visible exacto (normalizado) dentro del contenedor. */
export function findButtonByText(root: ParentNode, text: string): HTMLButtonElement {
  const match = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.replace(/\s+/g, " ").trim() === text
  );
  if (!match) throw new Error(`No se encontró el botón "${text}"`);
  return match;
}

/** Busca un elemento obligatorio y falla con un mensaje claro si no existe. */
export function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`No se encontró el elemento "${selector}"`);
  return element;
}

/** Simula un pointerdown sobre el elemento (por ejemplo, un clic fuera de un desplegable) dentro de act. */
export function pointerDownOn(element: Element): void {
  act(() => {
    element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  });
}

/** Envía un formulario con una acción de React (form action) y espera a que termine la transición. */
export async function submitFormAsync(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    // La validación nativa (required, pattern) no es lo que se prueba aquí: se desactiva para llegar a la acción.
    form.noValidate = true;
    form.requestSubmit();
    await Promise.resolve();
  });
}

/** Espera a que las promesas pendientes (acciones simuladas) se resuelvan y React pinte el resultado. */
export async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}
