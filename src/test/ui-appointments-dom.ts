// Utilidades DOM para los tests de conducta de la agenda y el alta/edición de
// citas. Solo usan la API estándar del DOM y act() de React; no añaden
// dependencias. Los portales (listas de Select, diálogos) se buscan en body.
import { act } from "react";

/** Primer elemento del selector cuyo texto coincide exactamente. Falla si no existe. */
function elementWithText<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
  text: string
): T {
  const match = Array.from(root.querySelectorAll<T>(selector)).find(
    (element) => element.textContent?.trim() === text
  );
  if (!match) throw new Error(`No se encontró ${selector} con texto "${text}"`);
  return match;
}

/** Botón por texto exacto (busca en el nodo indicado; los portales se buscan en document.body). */
export function buttonWithText(root: ParentNode, text: string): HTMLButtonElement {
  return elementWithText<HTMLButtonElement>(root, "button", text);
}

/** Botón cuyo texto contiene el fragmento indicado (útil para tarjetas con descripción). */
export function buttonContainingText(root: ParentNode, fragment: string): HTMLButtonElement {
  const match = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    (button.textContent ?? "").includes(fragment)
  );
  if (!match) throw new Error(`No se encontró button que contenga "${fragment}"`);
  return match;
}

/** Elemento por aria-label exacto. Falla si no existe. */
export function byAriaLabel<T extends Element = HTMLElement>(root: ParentNode, label: string): T {
  const match = root.querySelector<T>(`[aria-label="${label}"]`);
  if (!match) throw new Error(`No se encontró elemento con aria-label "${label}"`);
  return match;
}

/** Texto propio de una etiqueta: solo sus nodos de texto directos (sin opciones de selects anidados). */
function ownText(label: HTMLLabelElement): string {
  return Array.from(label.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();
}

/** Etiqueta cuyo texto propio coincide; falla si no existe. */
function labelWithText(root: ParentNode, text: string): HTMLLabelElement {
  const match = Array.from(root.querySelectorAll("label")).find(
    (label) => ownText(label) === text
  );
  if (!match) throw new Error(`No se encontró <label> con texto "${text}"`);
  return match;
}

/** Input o textarea asociado a una etiqueta (htmlFor o anidado). */
export function fieldWithLabel<T extends HTMLInputElement | HTMLTextAreaElement>(
  root: ParentNode,
  text: string
): T {
  const label = labelWithText(root, text);
  const field = label.htmlFor
    ? document.getElementById(label.htmlFor)
    : label.querySelector("input, textarea");
  if (!field) throw new Error(`La etiqueta "${text}" no tiene campo asociado`);
  return field as T;
}

/** Botón disparador de un Select (custom listbox) asociado a una etiqueta. */
export function selectTriggerWithLabel(root: ParentNode, text: string): HTMLButtonElement {
  const label = labelWithText(root, text);
  const trigger = label.htmlFor
    ? document.getElementById(label.htmlFor)
    : label.querySelector("button[aria-haspopup='listbox']");
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error(`La etiqueta "${text}" no tiene un Select asociado`);
  }
  return trigger;
}

/** Texto visible del Select asociado a una etiqueta. */
export function selectedLabelOf(root: ParentNode, text: string): string {
  return selectTriggerWithLabel(root, text).textContent?.trim() ?? "";
}

/** Asigna un valor a un input/textarea controlado por React y dispara el evento input. */
export function setFieldValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("No se pudo acceder al setter de value");
  act(() => {
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Hace clic dentro de act(). */
export function click(element: Element): void {
  act(() => {
    (element as HTMLElement).click();
  });
}

/** Clic asíncrono: espera a que las transiciones/acciones disparadas terminen. */
export async function clickAndSettle(element: Element): Promise<void> {
  await act(async () => {
    (element as HTMLElement).click();
  });
}

/** Abre un Select por su etiqueta y elige la opción con ese texto exacto. */
export function chooseOption(root: ParentNode, labelText: string, optionText: string): void {
  click(selectTriggerWithLabel(root, labelText));
  const option = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role='option']")).find(
    (candidate) => candidate.textContent?.trim() === optionText
  );
  if (!option) throw new Error(`No se encontró la opción "${optionText}" en "${labelText}"`);
  click(option);
}

/** Como setFieldValue, pero espera a que terminen las acciones asíncronas que dispare el cambio. */
export async function setFieldValueAndSettle(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  const prototype =
    field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("No se pudo acceder al setter de value");
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Textos de las opciones nativas (ocultas) del Select asociado a una etiqueta, incluida la seleccionada. */
export function nativeOptionTexts(root: ParentNode, labelText: string): string[] {
  const label = labelWithText(root, labelText);
  // Primero el select anidado en la etiqueta (formulario de edición); si no, el hermano (asistente).
  const select = label.querySelector("select") ?? label.parentElement?.querySelector("select");
  if (!select) throw new Error(`La etiqueta "${labelText}" no tiene un <select> nativo`);
  return Array.from(select.options).map((option) => option.textContent?.trim() ?? "");
}
