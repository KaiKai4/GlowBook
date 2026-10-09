// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, setFieldValue } from "@/test/ui-shared-dom";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function inputElement(): HTMLInputElement {
    const element = mounted?.container.querySelector<HTMLInputElement>("input");
    if (!element) throw new Error("Falta el input");
    return element;
  }

  function toggleButton(): HTMLButtonElement {
    const button = mounted?.container.querySelector<HTMLButtonElement>("button[type='button']");
    if (!button) throw new Error("Falta el botón de mostrar contraseña");
    return button;
  }

  it("oculta la contraseña por defecto y ofrece mostrarla con un botón accesible", () => {
    mounted = mountComponent(<PasswordInput id="pwd" label="Contraseña" />);

    expect(inputElement().type).toBe("password");
    expect(toggleButton().getAttribute("aria-label")).toBe("Ver contraseña");
    expect(toggleButton().title).toBe("Ver contraseña");
  });

  it("alterna entre texto visible y oculto, actualizando la etiqueta del botón", () => {
    mounted = mountComponent(<PasswordInput id="pwd" label="Contraseña" />);

    clickElement(toggleButton());
    expect(inputElement().type).toBe("text");
    expect(toggleButton().getAttribute("aria-label")).toBe("Ocultar contraseña");

    clickElement(toggleButton());
    expect(inputElement().type).toBe("password");
    expect(toggleButton().getAttribute("aria-label")).toBe("Ver contraseña");
  });

  it("muestra el error, marca aria-invalid y vincula el mensaje", () => {
    mounted = mountComponent(<PasswordInput id="pwd" label="Contraseña" error="Mínimo 8 caracteres" />);

    expect(mounted.container.textContent).toContain("Mínimo 8 caracteres");
    expect(inputElement().getAttribute("aria-invalid")).toBe("true");
    expect(inputElement().getAttribute("aria-describedby")).toBe("pwd-description");
  });

  it("muestra la pista solo cuando no hay error", () => {
    mounted = mountComponent(<PasswordInput id="pwd" hint="Usa letras y números" />);

    expect(mounted.container.textContent).toContain("Usa letras y números");
    expect(inputElement().getAttribute("aria-invalid")).toBe("false");
  });

  it("notifica los cambios al padre y conserva el valor al alternar la visibilidad", () => {
    const onChange = vi.fn();
    mounted = mountComponent(<PasswordInput id="pwd" onChange={onChange} />);

    setFieldValue(inputElement(), "secreto123");
    clickElement(toggleButton());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(inputElement().value).toBe("secreto123");
    expect(inputElement().type).toBe("text");
  });

  it("el botón de visibilidad es de tipo button para no enviar el formulario", () => {
    mounted = mountComponent(<PasswordInput id="pwd" />);

    expect(toggleButton().type).toBe("button");
  });
});
