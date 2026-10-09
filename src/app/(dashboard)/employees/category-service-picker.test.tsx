// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { click } from "@/test/ui-people-dom";
import type { CategoryOption } from "./types";
import { CategoryServicePicker } from "./category-service-picker";

const CATEGORIES: CategoryOption[] = [
  {
    id: "cat-cabello",
    name: "Cabello",
    services: [
      { id: "svc-corte", name: "Corte" },
      { id: "svc-tinte", name: "Tinte" },
    ],
  },
  {
    id: "cat-unas",
    name: "Uñas",
    services: [{ id: "svc-manicura", name: "Manicura" }],
  },
  { id: "cat-vacia", name: "Cejas", services: [] },
];

function categoryButton(container: HTMLElement, name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent === name
  );
  if (!button) throw new Error(`No se encontró la categoría "${name}"`);
  return button;
}

function serviceCheckbox(container: HTMLElement, name: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll("label")).find((candidate) => candidate.textContent === name);
  const checkbox = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!checkbox) throw new Error(`No se encontró el servicio "${name}"`);
  return checkbox;
}

describe("CategoryServicePicker", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el mensaje de categorías vacías cuando no hay ninguna", () => {
    mounted = mountComponent(
      <CategoryServicePicker
        categories={[]}
        categoryIds={[]}
        serviceIds={[]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={vi.fn()}
        emptyCategoryMessage="No hay categorías. Crea servicios primero."
      />
    );

    expect(mounted.container.textContent).toContain("No hay categorías. Crea servicios primero.");
    expect(mounted.container.querySelectorAll("button")).toHaveLength(0);
  });

  it("usa los títulos por defecto cuando no se indican otros", () => {
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello"]}
        serviceIds={[]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={vi.fn()}
      />
    );

    expect(mounted.container.textContent).toContain("Categorías que atiende");
    expect(mounted.container.textContent).toContain("Servicios que realiza");
  });

  it("no muestra la lista de servicios hasta que hay una categoría seleccionada", () => {
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={[]}
        serviceIds={[]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={vi.fn()}
        serviceTitle="2. Servicios que realiza"
      />
    );

    expect(mounted.container.textContent).not.toContain("2. Servicios que realiza");
    expect(mounted.container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("marca como seleccionadas las categorías y los servicios recibidos", () => {
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello"]}
        serviceIds={["svc-tinte"]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={vi.fn()}
      />
    );

    expect(categoryButton(mounted.container, "Cabello").className).toContain("border-brand-400");
    expect(categoryButton(mounted.container, "Uñas").className).not.toContain("border-brand-400");
    expect(serviceCheckbox(mounted.container, "Tinte").checked).toBe(true);
    expect(serviceCheckbox(mounted.container, "Corte").checked).toBe(false);
  });

  it("muestra solo los servicios de las categorías seleccionadas, agrupados por categoría", () => {
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello", "cat-vacia"]}
        serviceIds={[]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={vi.fn()}
      />
    );

    expect(serviceCheckbox(mounted.container, "Corte")).toBeInstanceOf(HTMLInputElement);
    expect(serviceCheckbox(mounted.container, "Tinte")).toBeInstanceOf(HTMLInputElement);
    expect(mounted.container.querySelector('input[value="svc-manicura"]')).toBeNull();
    expect(mounted.container.textContent).toContain("Sin servicios en esta categoria.");
  });

  it("añade una categoría a la selección sin tocar los servicios elegidos", () => {
    const onCategoryIdsChange = vi.fn();
    const onServiceIdsChange = vi.fn();
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello"]}
        serviceIds={["svc-corte"]}
        onCategoryIdsChange={onCategoryIdsChange}
        onServiceIdsChange={onServiceIdsChange}
      />
    );

    click(categoryButton(mounted.container, "Uñas"));

    expect(onCategoryIdsChange).toHaveBeenCalledWith(["cat-cabello", "cat-unas"]);
    expect(onServiceIdsChange).toHaveBeenCalledWith(["svc-corte"]);
  });

  it("al quitar una categoría elimina también sus servicios seleccionados", () => {
    const onCategoryIdsChange = vi.fn();
    const onServiceIdsChange = vi.fn();
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello", "cat-unas"]}
        serviceIds={["svc-corte", "svc-manicura"]}
        onCategoryIdsChange={onCategoryIdsChange}
        onServiceIdsChange={onServiceIdsChange}
      />
    );

    click(categoryButton(mounted.container, "Cabello"));

    expect(onCategoryIdsChange).toHaveBeenCalledWith(["cat-unas"]);
    expect(onServiceIdsChange).toHaveBeenCalledWith(["svc-manicura"]);
  });

  it("marca y desmarca un servicio notificando la lista resultante", () => {
    const onServiceIdsChange = vi.fn();
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello"]}
        serviceIds={["svc-corte"]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={onServiceIdsChange}
      />
    );

    click(serviceCheckbox(mounted.container, "Tinte"));
    expect(onServiceIdsChange).toHaveBeenLastCalledWith(["svc-corte", "svc-tinte"]);

    click(serviceCheckbox(mounted.container, "Corte"));
    expect(onServiceIdsChange).toHaveBeenLastCalledWith([]);
  });

  it("solo renderiza campos ocultos para el formulario cuando se pide", () => {
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello"]}
        serviceIds={["svc-corte"]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={vi.fn()}
        renderHiddenInputs
      />
    );

    const categoryInput = mounted.container.querySelector<HTMLInputElement>('input[type="hidden"][name="category_ids"]');
    const serviceInput = mounted.container.querySelector<HTMLInputElement>('input[type="hidden"][name="service_ids"]');
    expect(categoryInput?.value).toBe("cat-cabello");
    expect(serviceInput?.value).toBe("svc-corte");
  });

  it("no renderiza campos ocultos por defecto", () => {
    mounted = mountComponent(
      <CategoryServicePicker
        categories={CATEGORIES}
        categoryIds={["cat-cabello"]}
        serviceIds={["svc-corte"]}
        onCategoryIdsChange={vi.fn()}
        onServiceIdsChange={vi.fn()}
      />
    );

    expect(mounted.container.querySelector('input[type="hidden"]')).toBeNull();
  });
});
