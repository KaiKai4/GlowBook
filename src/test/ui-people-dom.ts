// Utilidades DOM compartidas por los tests de conducta de la UI de personas
// (empleados, clientes, servicios y salón). Solo usan la API estándar del DOM
// y act() de React; no añaden dependencias.
import { act } from "react";

/** Devuelve el primer elemento del selector cuyo texto coincide exactamente. Falla si no existe. */
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

/** Botón por texto exacto dentro del nodo indicado (o de document.body para portales). */
export function buttonWithText(root: ParentNode, text: string): HTMLButtonElement {
  return elementWithText<HTMLButtonElement>(root, "button", text);
}

/** Campo de formulario (input o textarea) por atributo name. Falla si no existe. */
export function fieldByName<T extends HTMLInputElement | HTMLTextAreaElement>(
  root: ParentNode,
  name: string
): T {
  const field = root.querySelector<T>(`input[name="${name}"], textarea[name="${name}"]`);
  if (!field) throw new Error(`No se encontró el campo "${name}"`);
  return field;
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
export function click(element: HTMLElement): void {
  act(() => {
    element.click();
  });
}

/** Envía un formulario con requestSubmit y espera a que las acciones de formulario de React terminen. */
export async function submitForm(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.requestSubmit();
  });
}

/**
 * Abre un Select del design system localizando su trigger por el texto de su
 * <label> asociado y elige la opción visible indicada en el listbox del portal.
 */
export function chooseSelectOption(container: HTMLElement, labelText: string, optionText: string): void {
  const label = elementWithText<HTMLLabelElement>(container, "label", labelText);
  const triggerId = label.htmlFor;
  const trigger = document.getElementById(triggerId);
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error(`No se encontró el trigger del select "${labelText}"`);
  }
  click(trigger);
  click(buttonWithText(document.body, optionText));
}

/** Vacía la cola de microtareas y efectos pendientes dentro de act(). */
export async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * Abre un Select sin label localizando su trigger por el texto que muestra
 * (la opción seleccionada actualmente) y elige la opción indicada.
 */
export function chooseSelectOptionByCurrentText(container: HTMLElement, currentText: string, optionText: string): void {
  const trigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="listbox"]')).find(
    (button) => button.textContent?.trim() === currentText
  );
  if (!trigger) throw new Error(`No se encontró el select con texto actual "${currentText}"`);
  click(trigger);
  click(buttonWithText(document.body, optionText));
}

/** Botón por atributo aria-label exacto. Falla si no existe. */
export function buttonWithAriaLabel(root: ParentNode, label: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`No se encontró el botón con aria-label "${label}"`);
  return button;
}

/** Formulario del contenedor. Falla si no existe. */
export function formOf(root: ParentNode): HTMLFormElement {
  const form = root.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("No se encontró el formulario");
  return form;
}

/**
 * Campo (input o textarea) asociado a un <label> por su texto exacto. Usa el id
 * generado por el design system (slug del label) a través de htmlFor.
 */
export function fieldByLabel(root: ParentNode, labelText: string): HTMLInputElement | HTMLTextAreaElement {
  const label = elementWithText<HTMLLabelElement>(root, "label", labelText);
  const field = document.getElementById(label.htmlFor);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return field;
  throw new Error(`El label "${labelText}" no está asociado a un campo`);
}

/** Dispara el evento de salida de foco (React escucha focusout para onBlur). */
export function blur(field: HTMLInputElement | HTMLTextAreaElement): void {
  act(() => {
    field.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}
