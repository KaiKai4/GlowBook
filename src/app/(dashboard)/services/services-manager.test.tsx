// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buttonWithAriaLabel,
  buttonWithText,
  chooseSelectOption,
  chooseSelectOptionByCurrentText,
  click,
  fieldByName,
  flushAsync,
  formOf,
  setFieldValue,
  submitForm,
} from "@/test/ui-people-dom";
import { buildCategory, buildService } from "@/test/ui-people-fixtures";
import {
  archiveCategoryAction,
  createCategoryAction,
  createServiceAction,
  updateCategoryPricingModeAction,
  updateServiceAction,
} from "./actions";
import { ServicesManager } from "./services-manager";
import type { Category } from "./services-types";

vi.mock("./actions", () => ({
  archiveCategoryAction: vi.fn(),
  createCategoryAction: vi.fn(),
  createServiceAction: vi.fn(),
  updateCategoryPricingModeAction: vi.fn(),
  updateServiceAction: vi.fn(),
}));

const SEARCH_PLACEHOLDER = 'input[placeholder="Buscar servicio..."]';

function sidebarRow(container: HTMLElement, label: string): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll<HTMLButtonElement>("li > button")).find((button) =>
    button.textContent?.startsWith(label)
  );
  if (!row) throw new Error(`No se encontró la fila de la barra lateral "${label}"`);
  return row;
}

function sectionHeadings(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("section h2")).map((heading) => heading.textContent ?? "");
}

function serviceNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("section .group > div > div > p.font-medium")).map(
    (name) => name.textContent ?? ""
  );
}

const CABELLO: Category = buildCategory({
  id: "cat-1",
  name: "Cabello",
  services: [
    buildService({ id: "svc-1", name: "Corte de cabello", category_id: "cat-1", is_active: true }),
    buildService({ id: "svc-2", name: "Tinte completo", category_id: "cat-1", is_active: false }),
  ],
});

const UNAS: Category = buildCategory({
  id: "cat-2",
  name: "Uñas",
  pricing_mode: "variable",
  services: [buildService({ id: "svc-3", name: "Manicura", category_id: "cat-2", is_active: true })],
});

const MASAJES: Category = buildCategory({
  id: "cat-3",
  name: "Masajes",
  services: [buildService({ id: "svc-4", name: "Masaje relajante", category_id: "cat-3", is_active: true })],
});

const CEJAS: Category = buildCategory({
  id: "cat-4",
  name: "Cejas",
  services: [buildService({ id: "svc-5", name: "Diseño de cejas", category_id: "cat-4", is_active: true })],
});

describe("ServicesManager", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(createCategoryAction).mockReset();
    vi.mocked(createServiceAction).mockReset();
    vi.mocked(updateServiceAction).mockReset();
    vi.mocked(updateCategoryPricingModeAction).mockReset();
    vi.mocked(archiveCategoryAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el estado vacío y deshabilita Nuevo servicio cuando no hay categorías", () => {
    mounted = mountComponent(<ServicesManager categories={[]} />);

    expect(mounted.container.textContent).toContain("Crea tu primera categoría para empezar.");
    expect(buttonWithText(mounted.container, "Nuevo servicio").disabled).toBe(true);
    expect(sectionHeadings(mounted.container)).toEqual([]);
  });

  it("muestra las categorías y los totales de servicios e inactivos", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    expect(sectionHeadings(mounted.container)).toEqual(["Cabello", "Uñas"]);
    expect(mounted.container.textContent).toContain("1 inact.");
    expect(sidebarRow(mounted.container, "Todas").textContent).toBe("Todas3");
    expect(buttonWithText(mounted.container, "Nuevo servicio").disabled).toBe(false);
  });

  it("filtra los servicios por texto de búsqueda y oculta categorías sin coincidencias", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    const search = mounted.container.querySelector<HTMLInputElement>(SEARCH_PLACEHOLDER);
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "manicura");

    expect(sectionHeadings(mounted.container)).toEqual(["Uñas"]);
    expect(serviceNames(mounted.container)).toEqual(["Manicura"]);
  });

  it("filtra por estado inactivo y deja solo los servicios desactivados", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    chooseSelectOptionByCurrentText(mounted.container, "Todos los estados", "Inactivos");

    expect(serviceNames(mounted.container)).toEqual(["Tinte completo"]);
    expect(sectionHeadings(mounted.container)).toEqual(["Cabello"]);
  });

  it("muestra solo la categoría elegida en la barra lateral", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    click(sidebarRow(mounted.container, "Uñas"));

    expect(sectionHeadings(mounted.container)).toEqual(["Uñas"]);
  });

  it("página las categorías de tres en tres y permite avanzar y retroceder", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS, MASAJES, CEJAS]} />);

    expect(sectionHeadings(mounted.container)).toEqual(["Cabello", "Uñas", "Masajes"]);
    expect(mounted.container.textContent).toContain("1-3 de 4");
    expect(mounted.container.textContent).toContain("Página 1 de 2");
    expect(buttonWithText(mounted.container, "Anterior").disabled).toBe(true);

    click(buttonWithText(mounted.container, "Siguiente"));

    expect(sectionHeadings(mounted.container)).toEqual(["Cejas"]);
    expect(mounted.container.textContent).toContain("4-4 de 4");
    expect(buttonWithText(mounted.container, "Siguiente").disabled).toBe(true);

    click(buttonWithText(mounted.container, "Anterior"));

    expect(sectionHeadings(mounted.container)).toEqual(["Cabello", "Uñas", "Masajes"]);
  });

  it("vuelve a la página 1 al cambiar el filtro de búsqueda", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS, MASAJES, CEJAS]} />);
    click(buttonWithText(mounted.container, "Siguiente"));

    const search = mounted.container.querySelector<HTMLInputElement>(SEARCH_PLACEHOLDER);
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "e");

    expect(sectionHeadings(mounted.container)).toEqual(["Cabello", "Masajes", "Cejas"]);
    expect(mounted.container.textContent).not.toContain("Página");
  });

  it("crea una categoría y cierra el diálogo cuando la acción responde ok", async () => {
    vi.mocked(createCategoryAction).mockResolvedValue({ ok: true, value: "cat-new" });
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithText(mounted.container, "+ Nueva"));
    setFieldValue(fieldByName(document.body, "name"), "Barbería");
    await submitForm(formOf(document.body));

    expect(createCategoryAction).toHaveBeenCalledTimes(1);
    const [, formData] = vi.mocked(createCategoryAction).mock.calls[0] ?? [];
    expect(formData?.get("name")).toBe("Barbería");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("mantiene abierto el diálogo de categoría y muestra el error de la acción", async () => {
    vi.mocked(createCategoryAction).mockResolvedValue({ ok: false, error: "Ya existe una categoría con ese nombre" });
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithText(mounted.container, "+ Nueva"));
    setFieldValue(fieldByName(document.body, "name"), "Cabello");
    await submitForm(formOf(document.body));

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Ya existe una categoría con ese nombre");
  });

  it("abre Nuevo servicio con la categoría activa preseleccionada y la envía a la acción", async () => {
    vi.mocked(createServiceAction).mockResolvedValue({ ok: true, value: "svc-new" });
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    click(sidebarRow(mounted.container, "Uñas"));
    click(buttonWithText(mounted.container, "Nuevo servicio"));
    setFieldValue(fieldByName(document.body, "name"), "Pedicura");
    await submitForm(formOf(document.body));

    expect(createServiceAction).toHaveBeenCalledTimes(1);
    const [, formData] = vi.mocked(createServiceAction).mock.calls[0] ?? [];
    expect(formData?.get("category_id")).toBe("cat-2");
    expect(formData?.get("name")).toBe("Pedicura");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("crea un servicio dentro de la categoría indicada desde su sección", async () => {
    vi.mocked(createServiceAction).mockResolvedValue({ ok: false, error: "La duración debe ser de al menos 1 minuto" });
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    click(buttonWithText(mounted.container, "+ Agregar"));

    expect(document.body.textContent).toContain("Nuevo servicio");
    expect(document.body.querySelector<HTMLInputElement>('input[name="category_id"]')?.value).toBe("cat-1");
    setFieldValue(fieldByName(document.body, "name"), "Lavado");
    await submitForm(formOf(document.body));

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("La duración debe ser de al menos 1 minuto");
  });

  it("alterna el modo de precio de la categoría llamando a la acción con el modo contrario", async () => {
    vi.mocked(updateCategoryPricingModeAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithText(mounted.container, "Precio fijo"));
    await flushAsync();

    expect(updateCategoryPricingModeAction).toHaveBeenCalledWith("cat-1", "variable");
  });

  it("edita un servicio y envía su id junto con los datos del formulario", async () => {
    vi.mocked(updateServiceAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithAriaLabel(mounted.container, "Editar Corte de cabello"));
    setFieldValue(fieldByName(document.body, "name"), "Corte premium");
    chooseSelectOption(document.body, "Estado", "Inactivo");
    await submitForm(formOf(document.body));

    expect(updateServiceAction).toHaveBeenCalledTimes(1);
    const [serviceId, , formData] = vi.mocked(updateServiceAction).mock.calls[0] ?? [];
    expect(serviceId).toBe("svc-1");
    expect(formData?.get("name")).toBe("Corte premium");
    expect(formData?.get("is_active")).toBe("false");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("archiva una categoría tras confirmar y reinicia la selección si era la activa", async () => {
    vi.mocked(archiveCategoryAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    click(sidebarRow(mounted.container, "Cabello"));
    click(buttonWithAriaLabel(mounted.container, "Archivar categoría Cabello"));
    expect(document.body.textContent).toContain('Vas a archivar "Cabello".');
    click(buttonWithText(document.body, "Archivar categoría"));
    await flushAsync();

    expect(archiveCategoryAction).toHaveBeenCalledWith("cat-1");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(sectionHeadings(mounted.container)).toEqual(["Cabello", "Uñas"]);
  });

  it("muestra el error de archivado y conserva el diálogo abierto", async () => {
    vi.mocked(archiveCategoryAction).mockResolvedValue({ ok: false, error: "No se puede archivar una categoría con citas activas" });
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithAriaLabel(mounted.container, "Archivar categoría Cabello"));
    click(buttonWithText(document.body, "Archivar categoría"));
    await flushAsync();

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("No se puede archivar una categoría con citas activas");
  });

  it("alterna de variable a fijo el modo de precio de una categoría variable", async () => {
    vi.mocked(updateCategoryPricingModeAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<ServicesManager categories={[UNAS]} />);

    click(buttonWithText(mounted.container, "Precio variable"));
    await flushAsync();

    expect(updateCategoryPricingModeAction).toHaveBeenCalledWith("cat-2", "fixed");
  });

  it("si cambiar el modo de precio falla se muestra el error al usuario", async () => {
    vi.mocked(updateCategoryPricingModeAction).mockResolvedValue({ ok: false, error: "No se pudo cambiar el precio" });
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithText(mounted.container, "Precio fijo"));
    await flushAsync();

    expect(updateCategoryPricingModeAction).toHaveBeenCalledWith("cat-1", "variable");
    expect(mounted.container.textContent).toContain("No se pudo cambiar el precio");
  });

  it("muestra el error cuando la edición del servicio falla y mantiene el diálogo abierto", async () => {
    vi.mocked(updateServiceAction).mockResolvedValue({ ok: false, error: "El precio debe ser mayor que cero" });
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithAriaLabel(mounted.container, "Editar Corte de cabello"));
    await submitForm(formOf(document.body));
    await flushAsync();

    expect(document.body.querySelector("[role=\"dialog\"]")).not.toBeNull();
    expect(document.body.textContent).toContain("El precio debe ser mayor que cero");
  });

  it("filtra por servicios activos y conserva la categoría aunque no tenga coincidencias", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    chooseSelectOptionByCurrentText(mounted.container, "Todos los estados", "Activos");
    expect(serviceNames(mounted.container)).toEqual(["Corte de cabello", "Manicura"]);

    click(sidebarRow(mounted.container, "Cabello"));
    const search = mounted.container.querySelector<HTMLInputElement>(SEARCH_PLACEHOLDER);
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "zzz");

    expect(sectionHeadings(mounted.container)).toEqual(["Cabello"]);
    expect(mounted.container.textContent).toContain("Sin servicios en esta categoría.");
  });

  it("usa la primera categoría como destino de Nuevo servicio cuando se ven todas", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    click(buttonWithText(mounted.container, "Nuevo servicio"));

    expect(document.body.querySelector<HTMLInputElement>('input[name="category_id"]')?.value).toBe("cat-1");
  });

  it("abre la creación de categoría desde el estado vacío", () => {
    mounted = mountComponent(<ServicesManager categories={[]} />);

    click(buttonWithText(mounted.container, "Nueva categoría"));

    expect(document.body.querySelector("[role=\"dialog\"] h2")?.textContent).toBe("Nueva categoría");
  });

  it("cierra los diálogos de categoría y de servicio al cancelar", () => {
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithText(mounted.container, "+ Nueva"));
    click(buttonWithText(document.body, "Cancelar"));
    expect(document.body.querySelector("[role=\"dialog\"]")).toBeNull();

    click(buttonWithText(mounted.container, "Nuevo servicio"));
    click(buttonWithText(document.body, "Cancelar"));
    expect(document.body.querySelector("[role=\"dialog\"]")).toBeNull();
  });

  it("no cierra la edición del servicio con la X mientras se guarda", () => {
    vi.mocked(updateServiceAction).mockReturnValue(new Promise<never>(() => undefined));
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithAriaLabel(mounted.container, "Editar Corte de cabello"));
    click(buttonWithText(document.body, "Guardar cambios"));
    click(buttonWithAriaLabel(document.body, "Cerrar"));

    expect(document.body.querySelector("[role=\"dialog\"] h2")?.textContent).toBe("Editar servicio");
  });

  it("no cierra el diálogo de archivado con la X mientras se archiva", () => {
    vi.mocked(archiveCategoryAction).mockReturnValue(new Promise<never>(() => undefined));
    mounted = mountComponent(<ServicesManager categories={[CABELLO]} />);

    click(buttonWithAriaLabel(mounted.container, "Archivar categoría Cabello"));
    click(buttonWithText(document.body, "Archivar categoría"));
    click(buttonWithAriaLabel(document.body, "Cerrar"));

    expect(document.body.textContent).toContain('Vas a archivar "Cabello".');
  });

  it("al archivar una categoría distinta de la activa conserva la selección actual", async () => {
    vi.mocked(archiveCategoryAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<ServicesManager categories={[CABELLO, UNAS]} />);

    click(buttonWithAriaLabel(mounted.container, "Archivar categoría Uñas"));
    click(buttonWithText(document.body, "Archivar categoría"));
    await flushAsync();

    expect(archiveCategoryAction).toHaveBeenCalledWith("cat-2");
    expect(sidebarRow(mounted.container, "Todas").className).toContain("font-medium");
  });
});
