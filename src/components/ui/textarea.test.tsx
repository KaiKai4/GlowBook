// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { setFieldValue } from "@/test/ui-shared-dom";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function areaElement(): HTMLTextAreaElement {
    const element = mounted?.container.querySelector<HTMLTextAreaElement>("textarea");
    if (!element) throw new Error("Falta el textarea");
    return element;
  }

  it("asocia la etiqueta con el textarea mediante un id generado", () => {
    mounted = mountComponent(<Textarea label="Nota Interna" />);

    const label = mounted.container.querySelector("label");
    expect(label?.textContent).toBe("Nota Interna");
    expect(areaElement().id).not.toBe("");
    expect(label?.getAttribute("for")).toBe(areaElement().id);
  });

  it("prioriza el id explícito sobre el derivado de la etiqueta", () => {
    mounted = mountComponent(<Textarea label="Nota" id="comentario" />);

    expect(areaElement().id).toBe("comentario");
    expect(mounted.container.querySelector("label")?.getAttribute("for")).toBe("comentario");
  });

  it("sin etiqueta no renderiza label", () => {
    mounted = mountComponent(<Textarea placeholder="Escribe" />);

    expect(mounted.container.querySelector("label")).toBeNull();
    expect(areaElement().placeholder).toBe("Escribe");
  });

  it("muestra el error y marca el borde con la clase de error", () => {
    mounted = mountComponent(<Textarea label="Motivo" error="Es obligatorio" />);

    expect(mounted.container.textContent).toContain("Es obligatorio");
    expect(areaElement().className).toContain("border-danger");
  });

  it("sin error no muestra mensaje ni clase de error", () => {
    mounted = mountComponent(<Textarea label="Motivo" />);

    expect(mounted.container.querySelector(".text-danger")).toBeNull();
    expect(areaElement().className).not.toContain("border-danger");
  });

  it("notifica cada cambio al padre con el valor escrito", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<Textarea label="Motivo" onChange={onChange} />);

    setFieldValue(areaElement(), "Cliente pidió reagendar");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].target.value).toBe("Cliente pidió reagendar");
  });

  it("combina className con las clases base", () => {
    mounted = mountComponent(<Textarea className="min-h-40" />);

    expect(areaElement().className).toContain("min-h-40");
    expect(areaElement().className).toContain("resize-y");
  });
});
