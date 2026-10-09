// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, pointerDownOn, pressKey, requireElement } from "@/test/ui-shared-dom";
import { Select } from "./select";

function optionsList(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
}

function listbox(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="listbox"]');
}

function trigger(container: HTMLElement): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(container, "button[aria-haspopup='listbox']");
}

describe("Select", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra por defecto la primera opción cuando no hay valor inicial", () => {
    mounted = mountComponent(
      <Select label="Servicio">
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
      </Select>
    );

    expect(trigger(mounted.container).textContent).toContain("Corte");
  });

  it("muestra el placeholder cuando el valor controlado no coincide con ninguna opción", () => {
    mounted = mountComponent(
      <Select value="zzz" placeholder="Elige un servicio" onChange={vi.fn()}>
        <option value="corte">Corte</option>
      </Select>
    );

    expect(trigger(mounted.container).textContent).toContain("Elige un servicio");
  });

  it("usa el texto genérico cuando no coincide valor ni hay placeholder", () => {
    mounted = mountComponent(
      <Select value="zzz" onChange={vi.fn()}>
        <option value="corte">Corte</option>
      </Select>
    );

    expect(trigger(mounted.container).textContent).toContain("Selecciona una opcion");
  });

  it("enlaza la etiqueta con el disparador", () => {
    mounted = mountComponent(
      <Select label="Sucursal">
        <option value="norte">Norte</option>
      </Select>
    );

    expect(mounted.container.querySelector("label")?.getAttribute("for")).toBe("sucursal");
    expect(trigger(mounted.container).id).toBe("sucursal");
  });

  // La opción seleccionada aparece en la lista marcada; las ocultas no.
  it("al abrir muestra todas las opciones visibles, marcando la seleccionada, sin las ocultas", () => {
    mounted = mountComponent(
      <Select label="Servicio" defaultValue="tinte">
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
        <option value="oculto" hidden>
          Oculto
        </option>
        <option value="manicure">Manicure</option>
      </Select>
    );

    clickElement(trigger(mounted.container));

    expect(trigger(mounted.container).getAttribute("aria-expanded")).toBe("true");
    expect(listbox()?.getAttribute("aria-labelledby")).toBe("servicio");
    expect(optionsList().map((option) => option.textContent)).toEqual(["Corte", "Tinte", "Manicure"]);
    const selected = optionsList().find((option) => option.textContent === "Tinte");
    expect(selected?.getAttribute("aria-selected")).toBe("true");
    expect(optionsList().find((option) => option.textContent === "Corte")?.getAttribute("aria-selected")).toBe("false");
  });

  it("un select de una sola opción muestra esa opción marcada y no 'Sin opciones'", () => {
    mounted = mountComponent(
      <Select label="Sede">
        <option value="norte">Norte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));

    expect(optionsList().map((option) => option.textContent)).toEqual(["Norte"]);
    expect(document.body.textContent).not.toContain("Sin opciones");
  });

  it("selecciona una opción con el clic: notifica el valor, actualiza el disparador y cierra la lista", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <Select label="Servicio" name="service_id" onChange={onChange}>
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));
    const tinte = optionsList().find((option) => option.textContent === "Tinte");
    if (!tinte) throw new Error("Falta la opción Tinte");
    clickElement(tinte);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].target.value).toBe("tinte");
    expect(trigger(mounted.container).textContent).toContain("Tinte");
    expect(listbox()).toBeNull();
    expect(mounted.container.querySelector<HTMLInputElement>('input[name="service_id"]')?.value).toBe("tinte");
  });

  it("con valor controlado no cambia por sí mismo aunque notifique el cambio", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <Select label="Servicio" value="corte" onChange={onChange}>
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));
    const tinte = optionsList().find((option) => option.textContent === "Tinte");
    if (!tinte) throw new Error("Falta la opción Tinte");
    clickElement(tinte);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(trigger(mounted.container).textContent).toContain("Corte");
  });

  it("las opciones deshabilitadas no se pueden elegir", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <Select label="Servicio" onChange={onChange}>
        <option value="corte">Corte</option>
        <option value="tinte" disabled>
          Tinte
        </option>
      </Select>
    );

    clickElement(trigger(mounted.container));
    const disabled = optionsList().find((option) => option.textContent === "Tinte");
    expect(disabled).toBeInstanceOf(HTMLButtonElement);
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    if (disabled) clickElement(disabled);

    expect(onChange).not.toHaveBeenCalled();
    expect(listbox()).not.toBeNull();
  });

  it("una única opción seleccionada aparece marcada, sin 'Sin opciones'", () => {
    mounted = mountComponent(
      <Select label="Servicio">
        <option value="corte">Corte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));

    expect(optionsList()).toHaveLength(1);
    expect(optionsList()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(listbox()?.textContent).not.toContain("Sin opciones");
  });

  it("el disparador deshabilitado no abre la lista", () => {
    mounted = mountComponent(
      <Select label="Servicio" disabled>
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));

    expect(trigger(mounted.container).disabled).toBe(true);
    expect(listbox()).toBeNull();
  });

  it("el clic en el disparador con la lista abierta la cierra", () => {
    mounted = mountComponent(
      <Select label="Servicio">
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));
    expect(listbox()).not.toBeNull();

    clickElement(trigger(mounted.container));
    expect(listbox()).toBeNull();
  });

  it("navega con flechas, cicla al llegar al final y elige con Enter", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <Select label="Servicio" defaultValue="corte" onChange={onChange}>
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
        <option value="manicure">Manicure</option>
      </Select>
    );

    pressKey(trigger(mounted.container), "ArrowDown");
    expect(listbox()).not.toBeNull();

    pressKey(trigger(mounted.container), "ArrowDown");
    pressKey(trigger(mounted.container), "ArrowDown");
    pressKey(trigger(mounted.container), "ArrowUp");
    pressKey(trigger(mounted.container), "Enter");

    // El cursor parte de la primera opción (corte), que ahora también está en la lista.
    expect(onChange.mock.calls[0]?.[0].target.value).toBe("tinte");
  });

  it("la flecha arriba desde el primer elemento da la vuelta al último", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <Select label="Servicio" defaultValue="corte" onChange={onChange}>
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
        <option value="manicure">Manicure</option>
      </Select>
    );

    // Con la lista abierta el foco queda en la primera opción seleccionable (Tinte).
    pressKey(trigger(mounted.container), "ArrowDown");
    pressKey(trigger(mounted.container), "ArrowUp");
    pressKey(trigger(mounted.container), " ");

    expect(onChange.mock.calls[0]?.[0].target.value).toBe("manicure");
  });

  it("Enter con la lista cerrada solo la abre sin elegir nada", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <Select label="Servicio" onChange={onChange}>
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
      </Select>
    );

    pressKey(trigger(mounted.container), "Enter");

    expect(listbox()).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Escape cierra la lista y devuelve el foco al disparador", () => {
    mounted = mountComponent(
      <Select label="Servicio">
        <option value="corte">Corte</option>
        <option value="tinte">Tinte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));
    pressKey(document.body, "Escape");

    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger(mounted.container));
  });

  it("un pointerdown fuera del disparador y de la lista la cierra", () => {
    mounted = mountComponent(
      <Select label="Servicio">
        <option value="corte">Corte</option>
      </Select>
    );

    clickElement(trigger(mounted.container));
    pointerDownOn(document.body);

    expect(listbox()).toBeNull();
  });

  it("muestra el error y lo vincula al disparador con aria-describedby", () => {
    mounted = mountComponent(
      <Select label="Servicio" error="Selecciona un servicio">
        <option value="corte">Corte</option>
      </Select>
    );

    expect(mounted.container.textContent).toContain("Selecciona un servicio");
    expect(trigger(mounted.container).getAttribute("aria-describedby")).toBe("servicio-error");
    expect(trigger(mounted.container).className).toContain("border-danger");
  });

  it("sin nombre no renderiza el input oculto del formulario", () => {
    mounted = mountComponent(
      <Select label="Servicio">
        <option value="corte">Corte</option>
      </Select>
    );

    expect(mounted.container.querySelector('input[type="hidden"]')).toBeNull();
  });

  it("toma como texto de la opción el contenido anidado y como valor el texto cuando no hay value", () => {
    mounted = mountComponent(
      <Select label="Servicio" defaultValue="Alisado">
        <option>
          <span>Alisado</span>
        </option>
        <option>Keratina</option>
      </Select>
    );

    expect(trigger(mounted.container).textContent).toContain("Alisado");
    clickElement(trigger(mounted.container));
    expect(optionsList().map((option) => option.textContent)).toEqual(["Alisado", "Keratina"]);
  });
});
