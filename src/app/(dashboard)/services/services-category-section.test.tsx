// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithAriaLabel, buttonWithText, click } from "@/test/ui-people-dom";
import { buildCategory, buildService } from "@/test/ui-people-fixtures";
import { ServicesCategorySection } from "./services-category-section";

type SectionProps = Parameters<typeof ServicesCategorySection>[0];

function renderSection(
  overrides: Partial<Parameters<typeof ServicesCategorySection>[0]> = {},
  handlers: Partial<SectionProps> = {}
) {
  const props: SectionProps = {
    category: buildCategory(),
    pricingPending: false,
    pricingCategoryId: null,
    onTogglePricingMode: vi.fn(),
    onCreateService: vi.fn(),
    onEditService: vi.fn(),
    onArchiveCategory: vi.fn(),
    ...handlers,
    archivePending: false,
    archiveCategoryId: null,
    ...overrides,
  };
  return mountComponent(<ServicesCategorySection {...props} />);
}

describe("ServicesCategorySection", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el nombre de la categoría, el número de servicios y sus tarjetas", () => {
    mounted = renderSection({
      category: buildCategory({
        name: "Cabello",
        services: [buildService({ id: "s1", name: "Corte" }), buildService({ id: "s2", name: "Tinte" })],
      }),
    });

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Cabello");
    expect(mounted.container.textContent).toContain("2");
    expect(mounted.container.querySelectorAll("section .group")).toHaveLength(2);
    expect(mounted.container.textContent).toContain("Tinte");
  });

  it("indica que la categoría no tiene servicios cuando está vacía", () => {
    mounted = renderSection({ category: buildCategory({ services: [] }) });

    expect(mounted.container.textContent).toContain("Sin servicios en esta categoria.");
    expect(mounted.container.querySelector("section .group")).toBeNull();
  });

  it("muestra el modo de precio actual y lo alterna al pulsarlo", () => {
    const onTogglePricingMode = vi.fn();
    const category = buildCategory({ pricing_mode: "fixed" });
    mounted = renderSection({ category }, { onTogglePricingMode });

    click(buttonWithText(mounted.container, "Precio fijo"));

    expect(onTogglePricingMode).toHaveBeenCalledWith(category);
  });

  it("muestra Precio variable cuando la categoría usa precio variable", () => {
    mounted = renderSection({ category: buildCategory({ pricing_mode: "variable" }) });

    expect(buttonWithText(mounted.container, "Precio variable").title).toBe("Cambiar modo de precio de la categoria");
  });

  it("deshabilita el cambio de modo solo en la categoría que se está actualizando", () => {
    const category = buildCategory({ id: "cat-1" });
    mounted = renderSection({ category, pricingPending: true, pricingCategoryId: "cat-1" });

    expect(buttonWithText(mounted.container, "Precio fijo").disabled).toBe(true);
  });

  it("no bloquea el cambio de modo cuando la actualización pendiente es de otra categoría", () => {
    mounted = renderSection({
      category: buildCategory({ id: "cat-1" }),
      pricingPending: true,
      pricingCategoryId: "cat-2",
    });

    expect(buttonWithText(mounted.container, "Precio fijo").disabled).toBe(false);
  });

  it("pide crear un servicio dentro de esta categoría", () => {
    const onCreateService = vi.fn();
    mounted = renderSection({ category: buildCategory({ id: "cat-9" }) }, { onCreateService });

    click(buttonWithText(mounted.container, "+ Agregar"));

    expect(onCreateService).toHaveBeenCalledWith("cat-9");
  });

  it("reenvía el servicio al editar una de sus tarjetas", () => {
    const onEditService = vi.fn();
    const service = buildService({ name: "Corte de cabello" });
    mounted = renderSection({ category: buildCategory({ services: [service] }) }, { onEditService });

    click(buttonWithAriaLabel(mounted.container, "Editar Corte de cabello"));

    expect(onEditService).toHaveBeenCalledWith(service);
  });

  it("solicita archivar la categoría desde su botón accesible", () => {
    const onArchiveCategory = vi.fn();
    const category = buildCategory({ name: "Uñas" });
    mounted = renderSection({ category }, { onArchiveCategory });

    click(buttonWithAriaLabel(mounted.container, "Archivar categoria Uñas"));

    expect(onArchiveCategory).toHaveBeenCalledWith(category);
  });

  it("bloquea el botón de archivar mientras esta categoría se está archivando", () => {
    mounted = renderSection({
      category: buildCategory({ id: "cat-1", name: "Uñas" }),
      archivePending: true,
      archiveCategoryId: "cat-1",
    });

    expect(buttonWithAriaLabel(mounted.container, "Archivar categoria Uñas").disabled).toBe(
      true
    );
  });
});
