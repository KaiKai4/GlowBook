// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, pointerDownOn, pressKey, requireElement } from "@/test/ui-shared-dom";
import { TimePicker } from "./time-picker";

// jsdom no implementa scrollTo en elementos; el selector lo usa al elegir una opción.
function stubElementScroll(): void {
  if (!("scrollTo" in Element.prototype)) {
    Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  }
}

function trigger(container: HTMLElement): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(container, "button[aria-haspopup='dialog']");
}

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"][aria-label="Seleccionar hora"]');
}

function wheel(label: "Hora" | "Minutos"): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[role="listbox"][aria-label="${label}"]`);
  if (!element) throw new Error(`Falta la rueda ${label}`);
  return element;
}

function wheelOption(label: "Hora" | "Minutos", text: string): HTMLButtonElement {
  const match = Array.from(wheel(label).querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
    (option) => option.textContent === text
  );
  if (!match) throw new Error(`Falta la opción ${text} en ${label}`);
  return match;
}

function button(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>("[role='dialog'] button")).find(
    (candidate) => candidate.textContent?.trim() === text
  );
  if (!match) throw new Error(`Falta el botón ${text}`);
  return match;
}

function hiddenValue(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLInputElement>('input[name="slot"]')?.value;
}

describe("TimePicker (comportamiento del panel)", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    stubElementScroll();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("muestra la hora en formato de 12 horas con el sufijo en español", () => {
    mounted = mountComponent(<TimePicker value="14:30" label="Inicio" />);

    expect(trigger(mounted.container).textContent).toContain("2:30");
    expect(trigger(mounted.container).textContent).toContain("p. m.");
  });

  it("abre el panel con su título, marca el disparador como expandido y no lo abre si está deshabilitado", () => {
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" />);
    clickElement(trigger(mounted.container));

    expect(panel()).not.toBeNull();
    expect(trigger(mounted.container).getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.textContent).toContain("Seleccionar hora");
  });

  it("deshabilitado no abre el panel", () => {
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" disabled />);

    expect(trigger(mounted.container).disabled).toBe(true);
    clickElement(trigger(mounted.container));
    expect(panel()).toBeNull();
  });

  it("Cancelar cierra sin notificar ni cambiar el valor", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" onChange={onChange} />);
    clickElement(trigger(mounted.container));

    clickElement(wheelOption("Minutos", "45"));
    clickElement(button("Cancelar"));

    expect(onChange).not.toHaveBeenCalled();
    expect(panel()).toBeNull();
    expect(trigger(mounted.container).textContent).toContain("10:00");
  });

  it("al reabrir tras cancelar vuelve a mostrar el valor confirmado", () => {
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" onChange={vi.fn()} />);
    clickElement(trigger(mounted.container));
    clickElement(wheelOption("Minutos", "45"));
    clickElement(button("Cancelar"));

    clickElement(trigger(mounted.container));

    expect(wheel("Minutos").querySelector('[role="option"][aria-selected="true"]')?.textContent).toBe("00");
  });

  it("Guardar notifica el nuevo valor en formato HH:mm, cierra y actualiza el valor oculto", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<TimePicker name="slot" defaultValue="09:00" label="Inicio" onChange={onChange} />);
    clickElement(trigger(mounted.container));

    clickElement(wheelOption("Minutos", "30"));
    clickElement(button("Guardar"));

    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(panel()).toBeNull();
    expect(hiddenValue(mounted.container)).toBe("09:30");
  });

  it("el selector AM/PM convierte la hora a formato de 24 horas", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<TimePicker defaultValue="09:00" label="Inicio" onChange={onChange} />);
    clickElement(trigger(mounted.container));

    clickElement(requireElement<HTMLButtonElement>(document, 'button[role="radio"][aria-checked]:not([aria-checked="true"])'));
    clickElement(button("Guardar"));

    expect(onChange).toHaveBeenCalledWith("21:00");
  });

  it("muestra AM como período activo cuando la hora de la mañana está dentro del horario", () => {
    mounted = mountComponent(
      <TimePicker value="09:00" label="Inicio" min="08:00" max="10:00" onChange={vi.fn()} />
    );
    clickElement(trigger(mounted.container));

    const amRadio = requireElement<HTMLButtonElement>(document, 'button[role="radio"]');
    expect(amRadio.textContent).toBe("AM");
    expect(amRadio.getAttribute("aria-checked")).toBe("true");
  });

  it("un horario fuera de rango deshabilita Guardar y muestra el aviso", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <TimePicker value="09:00" label="Inicio" min="08:00" max="10:00" onChange={onChange} />
    );
    clickElement(trigger(mounted.container));

    clickElement(wheelOption("Hora", "11"));

    expect(panel()?.textContent).toContain("La hora está fuera del horario disponible.");
    expect(button("Guardar").disabled).toBe(true);
    clickElement(button("Guardar"));
    expect(onChange).not.toHaveBeenCalled();
    expect(panel()).not.toBeNull();
  });

  it("con máximo exclusivo, la hora igual al máximo no es válida", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <TimePicker value="09:00" label="Inicio" max="10:00" maxExclusive onChange={onChange} />
    );
    clickElement(trigger(mounted.container));

    clickElement(wheelOption("Hora", "10"));
    clickElement(wheelOption("Minutos", "00"));

    expect(button("Guardar").disabled).toBe(true);
  });

  it("el período fuera de rango se deshabilita y no puede elegirse", () => {
    mounted = mountComponent(
      <TimePicker value="09:00" label="Inicio" min="08:00" max="10:00" onChange={vi.fn()} />
    );
    clickElement(trigger(mounted.container));

    const pmRadio = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="radio"]')).find(
      (radio) => radio.textContent === "PM"
    );
    expect(pmRadio?.disabled).toBe(true);
  });

  it("Escape cierra el panel sin notificar y devuelve el foco al disparador", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" onChange={onChange} />);
    clickElement(trigger(mounted.container));

    pressKey(document.body, "Escape");

    expect(panel()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger(mounted.container));
  });

  it("un clic fuera del panel lo cierra sin notificar", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" onChange={onChange} />);
    clickElement(trigger(mounted.container));

    pointerDownOn(document.body);

    expect(panel()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra el error del campo y el borde de error en el disparador", () => {
    mounted = mountComponent(<TimePicker value="10:00" label="Inicio" error="Hora ocupada" />);

    expect(mounted.container.textContent).toContain("Hora ocupada");
    expect(trigger(mounted.container).className).toContain("border-danger");
  });

  it("sin etiqueta usa el aria-label por defecto o el indicado", () => {
    mounted = mountComponent(<TimePicker value="10:00" />);
    expect(trigger(mounted.container).getAttribute("aria-label")).toBe("Seleccionar hora");

    mounted.unmount();
    mounted = mountComponent(<TimePicker value="10:00" ariaLabel="Hora de cierre" />);
    expect(trigger(mounted.container).getAttribute("aria-label")).toBe("Hora de cierre");
  });
});
