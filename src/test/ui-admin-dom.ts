// Utilidades de interacción para tests de componentes de /admin en jsdom.
// Complementan render-dom.ts: disparan eventos dentro de act() de React.
import { act } from "react";

type TextField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Espera a que terminen las transiciones y acciones async pendientes. */
export async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Dispara un click dentro de act(). */
export function clickElement(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Cambia el valor de un campo controlado (input, textarea o select) como lo haría el usuario. */
export function changeFieldValue(field: TextField, value: string): void {
  const proto =
    field instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) throw new Error("No se pudo acceder al setter de value");
  setter.call(field, value);
  act(() => {
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

/** Busca un botón por su texto visible (coincidencia parcial). Falla si no existe. */
export function getButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((button) =>
    (button.textContent ?? "").replace(/\s+/g, " ").trim().includes(text)
  );
  if (!found) throw new Error(`Botón no encontrado: ${text}`);
  return found;
}

/** Busca un campo por su atributo name. Falla si no existe. */
export function getFieldByName<T extends TextField>(container: HTMLElement, name: string): T {
  const found = container.querySelector<T>(`[name="${name}"]`);
  if (!found) throw new Error(`Campo no encontrado: ${name}`);
  return found;
}
