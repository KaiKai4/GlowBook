// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, fieldByName, setFieldValue, submitForm, formOf } from "@/test/ui-people-dom";
import { buildCategory } from "@/test/ui-people-fixtures";
import { NewServiceDialog } from "./new-service-dialog";

const CATEGORIES = [
  buildCategory({ id: "cat-1", name: "Cabello" }),
  buildCategory({ id: "cat-2", name: "Uñas" }),
];

describe("NewServiceDialog", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra una opción por categoría y preselecciona la categoría por defecto", () => {
    mounted = mountComponent(
      <NewServiceDialog
        open
        categories={CATEGORIES}
        defaultCategory="cat-2"
        pending={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const hiddenCategory = mounted.container.querySelector<HTMLInputElement>('input[name="category_id"]');
    expect(hiddenCategory?.value).toBe("cat-2");
    expect(mounted.container.querySelector('button[aria-haspopup="listbox"]')?.textContent).toContain("Uñas");
  });

  it("envía los datos del servicio con la duración desglosada en horas y minutos", async () => {
    const onSubmit = vi.fn<(formData: FormData) => void>();
    mounted = mountComponent(
      <NewServiceDialog
        open
        categories={CATEGORIES}
        defaultCategory="cat-1"
        pending={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    setFieldValue(fieldByName(mounted.container, "name"), "Corte de cabello");
    setFieldValue(fieldByName(mounted.container, "duration_hours"), "1");
    setFieldValue(fieldByName(mounted.container, "duration_minutes_part"), "15");
    setFieldValue(fieldByName(mounted.container, "price"), "18.5");
    setFieldValue(fieldByName(mounted.container, "description"), "Incluye lavado");
    await submitForm(formOf(mounted.container));

    const formData = onSubmit.mock.calls[0]?.[0];
    expect(formData?.get("category_id")).toBe("cat-1");
    expect(formData?.get("name")).toBe("Corte de cabello");
    expect(formData?.get("duration_hours")).toBe("1");
    expect(formData?.get("duration_minutes_part")).toBe("15");
    expect(formData?.get("price")).toBe("18.5");
    expect(formData?.get("description")).toBe("Incluye lavado");
  });

  it("marca nombre, categoría, duración y precio como obligatorios", () => {
    mounted = mountComponent(
      <NewServiceDialog
        open
        categories={CATEGORIES}
        defaultCategory="cat-1"
        pending={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(fieldByName(mounted.container, "name").required).toBe(true);
    expect(fieldByName(mounted.container, "price").required).toBe(true);
    expect(fieldByName(mounted.container, "price").getAttribute("min")).toBe("0");
    expect(mounted.container.querySelector<HTMLInputElement>('input[name="category_id"]')?.required).toBe(true);
  });

  it("muestra el error devuelto al crear el servicio", () => {
    mounted = mountComponent(
      <NewServiceDialog
        open
        categories={CATEGORIES}
        defaultCategory="cat-1"
        pending={false}
        error="El precio no puede ser negativo"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(mounted.container.textContent).toContain("El precio no puede ser negativo");
  });

  it("cierra con Cancelar sin enviar el formulario", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    mounted = mountComponent(
      <NewServiceDialog
        open
        categories={CATEGORIES}
        defaultCategory="cat-1"
        pending={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    click(buttonWithText(mounted.container, "Cancelar"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("muestra el estado de carga en el botón de crear mientras está pendiente", () => {
    mounted = mountComponent(
      <NewServiceDialog
        open
        categories={CATEGORIES}
        defaultCategory="cat-1"
        pending
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(buttonWithText(mounted.container, "Crear servicio").disabled).toBe(true);
  });
});
