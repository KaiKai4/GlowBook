// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, pointerDownOn, pressKey, requireElement } from "@/test/ui-shared-dom";
import { DatePicker } from "./date-picker";

function trigger(container: HTMLElement): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(container, "button[aria-haspopup='dialog']");
}

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function dayButton(dayLabelSuffix: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>("[role='dialog'] button")).find(
    (button) => button.getAttribute("aria-label")?.endsWith(`, ${dayLabelSuffix}`)
  );
  if (!match) throw new Error(`No hay día que termine en "${dayLabelSuffix}"`);
  return match;
}

function headerLabel(): string {
  return requireElement<HTMLButtonElement>(document, '[aria-label="Cambiar vista del calendario"]').textContent ?? "";
}

describe("DatePicker", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra el placeholder cuando no hay fecha seleccionada", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="" onChange={vi.fn()} />);

    expect(trigger(mounted.container).textContent).toContain("Selecciona una fecha");
  });

  it("formatea la fecha en español de forma larga o compacta", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={vi.fn()} />);
    expect(trigger(mounted.container).textContent).toContain("15 de mayo de 2026");

    mounted?.unmount();
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" compact onChange={vi.fn()} />);
    expect(trigger(mounted.container).textContent).toContain("15/05/2026");
  });

  it("con granularidad mes muestra el placeholder y el nombre del mes", () => {
    mounted = mountComponent(<DatePicker label="Mes" granularity="month" value="" onChange={vi.fn()} />);
    expect(trigger(mounted.container).textContent).toContain("Selecciona un mes");

    mounted?.unmount();
    mounted = mountComponent(<DatePicker label="Mes" granularity="month" value="2026-05" onChange={vi.fn()} />);
    expect(trigger(mounted.container).textContent).toContain("mayo 2026");
  });

  it("un valor mal formado no se muestra como fecha", () => {
    mounted = mountComponent(<DatePicker label="Mes" granularity="month" value="2026-13" onChange={vi.fn()} />);

    expect(trigger(mounted.container).textContent).toContain("Selecciona un mes");
  });

  it("publica el valor en un input oculto cuando recibe name", () => {
    mounted = mountComponent(
      <DatePicker label="Fecha" name="starts_on" value="2026-05-15" onChange={vi.fn()} />
    );

    expect(mounted.container.querySelector<HTMLInputElement>('input[name="starts_on"]')?.value).toBe("2026-05-15");
  });

  it("abre el calendario del mes de la fecha seleccionada", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={vi.fn()} />);

    clickElement(trigger(mounted.container));

    expect(trigger(mounted.container).getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.getAttribute("aria-label")).toBe("Seleccionar fecha");
    expect(headerLabel()).toBe("mayo 2026");
    expect(dayButton("15 de mayo de 2026").getAttribute("aria-pressed")).toBe("true");
  });

  it("al elegir un día notifica la fecha en formato ISO, cierra y actualiza el disparador", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<DatePicker label="Fecha" name="day" defaultValue="2026-05-15" onChange={onChange} />);

    clickElement(trigger(mounted.container));
    clickElement(dayButton("20 de mayo de 2026"));

    expect(onChange).toHaveBeenCalledWith("2026-05-20");
    expect(panel()).toBeNull();
    expect(trigger(mounted.container).textContent).toContain("20 de mayo de 2026");
    expect(mounted.container.querySelector<HTMLInputElement>('input[name="day"]')?.value).toBe("2026-05-20");
  });

  it("con valor controlado el disparador sigue la prop aunque el usuario elija otro día", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={onChange} />);

    clickElement(trigger(mounted.container));
    clickElement(dayButton("20 de mayo de 2026"));

    expect(onChange).toHaveBeenCalledWith("2026-05-20");
    expect(trigger(mounted.container).textContent).toContain("15 de mayo de 2026");
  });

  it("deshabilita los días fuera de min y max", () => {
    mounted = mountComponent(
      <DatePicker label="Fecha" value="2026-05-15" min="2026-05-10" max="2026-05-20" onChange={vi.fn()} />
    );

    clickElement(trigger(mounted.container));

    expect(dayButton("9 de mayo de 2026").disabled).toBe(true);
    expect(dayButton("10 de mayo de 2026").disabled).toBe(false);
    expect(dayButton("20 de mayo de 2026").disabled).toBe(false);
    expect(dayButton("21 de mayo de 2026").disabled).toBe(true);
  });

  it("navega entre meses con las flechas del encabezado", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={vi.fn()} />);
    clickElement(trigger(mounted.container));

    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Mes siguiente"]'));
    expect(headerLabel()).toBe("junio 2026");

    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Mes anterior"]'));
    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Mes anterior"]'));
    expect(headerLabel()).toBe("abril 2026");
  });

  it("cambia de vista días -> años -> meses y permite fijar el mes con la vista de meses", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={onChange} />);
    clickElement(trigger(mounted.container));

    const viewButton = requireElement<HTMLButtonElement>(document, '[aria-label="Cambiar vista del calendario"]');
    clickElement(viewButton);
    expect(headerLabel()).toBe("2026");
    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Cambiar vista del calendario"]'));
    expect(headerLabel()).toBe("2016 - 2027");

    const yearButton = findButtonByText(document, "2024");
    clickElement(yearButton);
    expect(headerLabel()).toBe("2024");

    clickElement(findButtonByText(document, "mar"));
    expect(headerLabel()).toBe("marzo 2024");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("la flecha de año salta de a doce años en la vista de años", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={vi.fn()} />);
    clickElement(trigger(mounted.container));
    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Cambiar vista del calendario"]'));
    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Cambiar vista del calendario"]'));

    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Años siguientes"]'));
    expect(headerLabel()).toBe("2028 - 2039");
  });

  it("granularidad mes: abrir muestra la vista de meses y elegir uno notifica yyyy-MM", () => {
    const onChange = vi.fn();
    mounted = mountComponent(
      <DatePicker label="Mes" granularity="month" value="2026-05" onChange={onChange} />
    );

    clickElement(trigger(mounted.container));
    expect(panel()?.getAttribute("aria-label")).toBe("Seleccionar mes");
    expect(findButtonByText(document, "may").getAttribute("class")).toContain("bg-brand-600");

    clickElement(findButtonByText(document, "jun"));

    expect(onChange).toHaveBeenCalledWith("2026-06");
    expect(panel()).toBeNull();
  });

  it("granularidad día: elegir un mes en la vista de meses vuelve a la vista de días del nuevo mes", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={onChange} />);

    clickElement(trigger(mounted.container));
    clickElement(requireElement<HTMLButtonElement>(document, '[aria-label="Cambiar vista del calendario"]'));
    clickElement(findButtonByText(document, "nov"));

    expect(onChange).not.toHaveBeenCalled();
    expect(headerLabel()).toBe("noviembre 2026");
    expect(panel()).not.toBeNull();
  });

  it("Escape cierra el calendario y devuelve el foco al disparador", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={vi.fn()} />);
    clickElement(trigger(mounted.container));

    pressKey(document.body, "Escape");

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger(mounted.container));
  });

  it("un clic fuera del calendario lo cierra", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" onChange={vi.fn()} />);
    clickElement(trigger(mounted.container));

    pointerDownOn(document.body);

    expect(panel()).toBeNull();
  });

  it("un disparador deshabilitado no abre el calendario", () => {
    mounted = mountComponent(<DatePicker label="Fecha" value="2026-05-15" disabled onChange={vi.fn()} />);

    clickElement(trigger(mounted.container));

    expect(panel()).toBeNull();
  });

  it("muestra la pista o el error y vincula la descripción con el disparador", () => {
    mounted = mountComponent(
      <DatePicker label="Fecha" value="" error="La fecha es obligatoria" onChange={vi.fn()} />
    );

    expect(mounted.container.textContent).toContain("La fecha es obligatoria");
    expect(trigger(mounted.container).getAttribute("aria-describedby")).toMatch(/-description$/);
    expect(trigger(mounted.container).className).toContain("border-danger");

    mounted.unmount();
    mounted = mountComponent(<DatePicker label="Fecha" value="" hint="Formato dd/mm/aaaa" onChange={vi.fn()} />);
    expect(mounted.container.textContent).toContain("Formato dd/mm/aaaa");
  });

  it("usa aria-label de la prop o un texto genérico por granularidad cuando no hay etiqueta", () => {
    mounted = mountComponent(<DatePicker ariaLabel="Fecha de inicio" value="" onChange={vi.fn()} />);
    expect(trigger(mounted.container).getAttribute("aria-label")).toBe("Fecha de inicio");

    mounted.unmount();
    mounted = mountComponent(<DatePicker value="" granularity="month" onChange={vi.fn()} />);
    expect(trigger(mounted.container).getAttribute("aria-label")).toBe("Seleccionar mes");
  });
});
