// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, fieldByName, setFieldValue, submitForm, formOf } from "@/test/ui-people-dom";
import { CategoryDialog } from "./category-dialog";

describe("CategoryDialog", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("no renderiza nada cuando está cerrado", () => {
    mounted = mountComponent(
      <CategoryDialog open={false} pending={false} error={null} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("muestra el diálogo con título y campos de nombre, descripción y precio variable", () => {
    mounted = mountComponent(
      <CategoryDialog open pending={false} error={null} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    const dialog = mounted.container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.querySelector("h2")?.textContent).toBe("Nueva categoria");
    expect(fieldByName(mounted.container, "name").required).toBe(true);
    expect(fieldByName(mounted.container, "description").required).toBe(false);
    expect(mounted.container.textContent).toContain("Precio variable al completar");
  });

  it("envía nombre, descripción y el modo variable cuando el checkbox está marcado", async () => {
    const onSubmit = vi.fn<(formData: FormData) => void>();
    mounted = mountComponent(
      <CategoryDialog open pending={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />
    );

    setFieldValue(fieldByName(mounted.container, "name"), "Uñas");
    setFieldValue(fieldByName(mounted.container, "description"), "Manicura y pedicura");
    const checkbox = mounted.container.querySelector<HTMLInputElement>('input[name="pricing_mode"]');
    if (!checkbox) throw new Error("falta el checkbox de precio variable");
    click(checkbox);
    await submitForm(formOf(mounted.container));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const formData = onSubmit.mock.calls[0]?.[0];
    expect(formData?.get("name")).toBe("Uñas");
    expect(formData?.get("description")).toBe("Manicura y pedicura");
    expect(formData?.get("pricing_mode")).toBe("variable");
  });

  it("no envía pricing_mode cuando el checkbox queda sin marcar", async () => {
    const onSubmit = vi.fn<(formData: FormData) => void>();
    mounted = mountComponent(
      <CategoryDialog open pending={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />
    );

    setFieldValue(fieldByName(mounted.container, "name"), "Barbería");
    await submitForm(formOf(mounted.container));

    const formData = onSubmit.mock.calls[0]?.[0];
    expect(formData?.get("name")).toBe("Barbería");
    expect(formData?.has("pricing_mode")).toBe(false);
  });

  it("muestra el error devuelto por la acción", () => {
    mounted = mountComponent(
      <CategoryDialog open pending={false} error="Ya existe una categoría activa con ese nombre" onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(mounted.container.textContent).toContain("Ya existe una categoría activa con ese nombre");
  });

  it("bloquea el envío y muestra el estado de carga mientras está pendiente", () => {
    mounted = mountComponent(
      <CategoryDialog open pending error={null} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    const submit = buttonWithText(mounted.container, "Crear categoria");
    expect(submit.disabled).toBe(true);
    expect(submit.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("cierra con Cancelar y con la tecla Escape", () => {
    const onClose = vi.fn();
    mounted = mountComponent(<CategoryDialog open pending={false} error={null} onClose={onClose} onSubmit={vi.fn()} />);

    click(buttonWithText(mounted.container, "Cancelar"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
