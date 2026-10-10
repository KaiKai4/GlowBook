// @vitest-environment jsdom
import { act, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { setFieldValue } from "@/test/ui-shared-dom";
import { Input } from "./input";

describe("Input", () => {
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

  function inputElement(): HTMLInputElement {
    const element = mounted?.container.querySelector<HTMLInputElement>("input");
    if (!element) throw new Error("Falta el input");
    return element;
  }

  it("genera un id único con useId y enlaza el label con el input", () => {
    mounted = mountComponent(<Input label="Nombre completo" />);

    const id = inputElement().id;
    expect(id).not.toBe("");
    expect(mounted.container.querySelector("label")?.getAttribute("for")).toBe(id);
  });

  it("dos campos con la misma etiqueta reciben ids distintos", () => {
    mounted = mountComponent(
      <>
        <Input label="Nombre" />
        <Input label="Nombre" />
      </>
    );

    const ids = Array.from(mounted.container.querySelectorAll("input"), (input) => input.id);
    expect(ids[0]).not.toBe("");
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("sin etiqueta no renderiza label", () => {
    mounted = mountComponent(<Input placeholder="Buscar" />);

    expect(mounted.container.querySelector("label")).toBeNull();
  });

  it("muestra el error, marca aria-invalid y vincula la descripción", () => {
    mounted = mountComponent(<Input id="email" label="Email" error="Email inválido" hint="Ej: ana@mail.com" />);

    const message = mounted.container.querySelector<HTMLElement>("#email-description");
    expect(message?.textContent).toBe("Email inválido");
    expect(inputElement().getAttribute("aria-invalid")).toBe("true");
    expect(inputElement().getAttribute("aria-describedby")).toBe("email-description");
    expect(inputElement().className).toContain("border-danger");
    expect(mounted.container.textContent).not.toContain("Ej: ana@mail.com");
  });

  it("muestra la pista cuando no hay error", () => {
    mounted = mountComponent(<Input id="telefono" hint="Incluye el código de país" />);

    expect(mounted.container.textContent).toContain("Incluye el código de país");
    expect(inputElement().getAttribute("aria-invalid")).toBe("false");
    expect(inputElement().getAttribute("aria-describedby")).toBe("telefono-description");
  });

  it("sin mensajes no declara aria-describedby", () => {
    mounted = mountComponent(<Input id="simple" />);

    expect(inputElement().hasAttribute("aria-describedby")).toBe(false);
  });

  it("reenvía la ref al input nativo", () => {
    const ref = createRef<HTMLInputElement>();
    mounted = mountComponent(<Input ref={ref} id="ref-input" />);

    expect(ref.current).toBe(inputElement());
  });

  it("notifica cada cambio de texto al padre", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<Input id="texto" onChange={onChange} />);

    setFieldValue(inputElement(), "Ana");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(inputElement().value).toBe("Ana");
  });

  it("en campos numéricos elimina los ceros a la izquierda antes de notificar", () => {
    const seen: string[] = [];
    mounted = mountComponent(
      <Input id="cantidad" type="number" onChange={(event) => seen.push(event.currentTarget.value)} />
    );

    setFieldValue(inputElement(), "007");

    expect(inputElement().value).toBe("7");
    expect(seen).toEqual(["7"]);
  });

  it("normaliza ceros a la izquierda con signo negativo y conserva el cero solitario o vacío", () => {
    mounted = mountComponent(<Input id="ajuste" type="number" />);

    setFieldValue(inputElement(), "-005");
    expect(inputElement().value).toBe("-5");

    setFieldValue(inputElement(), "0");
    expect(inputElement().value).toBe("0");

    setFieldValue(inputElement(), "");
    expect(inputElement().value).toBe("");
  });

  it("no normaliza texto en campos que no son numéricos", () => {
    mounted = mountComponent(<Input id="codigo" />);

    setFieldValue(inputElement(), "007");

    expect(inputElement().value).toBe("007");
  });

  it("al enfocar un número igual a 0 selecciona el contenido para reemplazarlo", () => {
    mounted = mountComponent(<Input id="precio" type="number" defaultValue="0" />);
    const selectSpy = vi.spyOn(inputElement(), "select");

    act(() => {
      inputElement().focus();
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it("si el navegador no permite seleccionar, vacía el campo numérico", () => {
    mounted = mountComponent(<Input id="precio" type="number" defaultValue="0" />);
    vi.spyOn(inputElement(), "select").mockImplementation(() => {
      throw new Error("select no soportado");
    });

    act(() => {
      inputElement().focus();
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(inputElement().value).toBe("");
  });

  it("al enfocar un número distinto de 0 o un texto no selecciona nada", () => {
    mounted = mountComponent(
      <>
        <Input id="cantidad" type="number" defaultValue="5" />
        <Input id="nombre" defaultValue="0" />
      </>
    );
    const numberInput = mounted.container.querySelector<HTMLInputElement>("#cantidad");
    const textInput = mounted.container.querySelector<HTMLInputElement>("#nombre");
    if (!numberInput || !textInput) throw new Error("Faltan los inputs");
    const numberSelect = vi.spyOn(numberInput, "select");
    const textSelect = vi.spyOn(textInput, "select");

    act(() => {
      numberInput.focus();
    });
    act(() => {
      textInput.focus();
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(numberSelect).not.toHaveBeenCalled();
    expect(textSelect).not.toHaveBeenCalled();
  });

  it("en campos numéricos con valor 0 cancela el mouseup para no posicionar el cursor, y avisa al padre", () => {
    const onMouseUp = vi.fn();
    mounted = mountComponent(<Input id="precio" type="number" defaultValue="0" onMouseUp={onMouseUp} />);

    const event = new MouseEvent("mouseup", { bubbles: true, cancelable: true });
    act(() => {
      inputElement().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onMouseUp).toHaveBeenCalledTimes(1);
  });

  it("en campos de texto el mouseup no se cancela", () => {
    mounted = mountComponent(<Input id="nombre" defaultValue="0" />);

    const event = new MouseEvent("mouseup", { bubbles: true, cancelable: true });
    act(() => {
      inputElement().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });
});
