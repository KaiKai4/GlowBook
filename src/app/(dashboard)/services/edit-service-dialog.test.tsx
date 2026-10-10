// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, chooseSelectOption, click, fieldByName, submitForm, formOf } from "@/test/ui-people-dom";
import { buildCategory, buildService } from "@/test/ui-people-fixtures";
import { EditServiceDialog } from "./edit-service-dialog";

const CATEGORIES = [
  buildCategory({ id: "cat-1", name: "Cabello" }),
  buildCategory({ id: "cat-2", name: "Uñas" }),
];

describe("EditServiceDialog", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("no renderiza nada cuando no hay servicio seleccionado", () => {
    mounted = mountComponent(
      <EditServiceDialog
        service={null}
        categories={CATEGORIES}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("precarga los datos actuales del servicio en el formulario", () => {
    mounted = mountComponent(
      <EditServiceDialog
        service={buildService({
          category_id: "cat-2",
          name: "Manicura",
          price: 12.5,
          duration_minutes: 80,
          is_active: false,
          description: null,
        })}
        categories={CATEGORIES}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(fieldByName<HTMLInputElement>(mounted.container, "name").value).toBe("Manicura");
    expect(fieldByName<HTMLInputElement>(mounted.container, "price").value).toBe("12.5");
    expect(fieldByName<HTMLInputElement>(mounted.container, "duration_hours").value).toBe("1");
    expect(fieldByName<HTMLInputElement>(mounted.container, "duration_minutes_part").value).toBe("20");
    expect(fieldByName<HTMLTextAreaElement>(mounted.container, "description").value).toBe("");
    expect(mounted.container.querySelector<HTMLInputElement>('input[name="category_id"]')?.value).toBe("cat-2");
    expect(mounted.container.querySelector<HTMLInputElement>('input[name="is_active"]')?.value).toBe("false");
    expect(mounted.container.textContent).toContain("Actualiza precio, duración, categoría y estado.");
  });

  it("envía los cambios de categoría y estado elegidos en los selectores", async () => {
    const onSubmit = vi.fn<(formData: FormData) => void>();
    mounted = mountComponent(
      <EditServiceDialog
        service={buildService({ id: "svc-9", category_id: "cat-1", is_active: true })}
        categories={CATEGORIES}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    chooseSelectOption(mounted.container, "Categoría", "Uñas");
    chooseSelectOption(mounted.container, "Estado", "Inactivo");
    await submitForm(formOf(mounted.container));

    const formData = onSubmit.mock.calls[0]?.[0];
    expect(formData?.get("category_id")).toBe("cat-2");
    expect(formData?.get("is_active")).toBe("false");
  });

  it("muestra el error devuelto y el estado de carga mientras guarda", () => {
    mounted = mountComponent(
      <EditServiceDialog
        service={buildService()}
        categories={CATEGORIES}
        pending
        error="No se pudo guardar el servicio"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(mounted.container.textContent).toContain("No se pudo guardar el servicio");
    expect(buttonWithText(mounted.container, "Guardar cambios").disabled).toBe(true);
    expect(buttonWithText(mounted.container, "Cancelar").disabled).toBe(true);
  });

  it("cierra con Cancelar cuando no hay guardado en curso", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <EditServiceDialog
        service={buildService()}
        categories={CATEGORIES}
        pending={false}
        error={null}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    click(buttonWithText(mounted.container, "Cancelar"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
