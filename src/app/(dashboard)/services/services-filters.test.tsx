// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { chooseSelectOptionByCurrentText, click, setFieldValue } from "@/test/ui-people-dom";
import { ServicesFilters } from "./services-filters";

const SEARCH_SELECTOR = 'input[placeholder="Buscar servicio..."]';

describe("ServicesFilters", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra la búsqueda con el valor actual y el estado seleccionado en el selector", () => {
    mounted = mountComponent(
      <ServicesFilters query="corte" statusFilter="inactive" onQueryChange={vi.fn()} onStatusFilterChange={vi.fn()} />
    );

    expect(mounted.container.querySelector<HTMLInputElement>(SEARCH_SELECTOR)?.value).toBe("corte");
    expect(mounted.container.querySelector('button[aria-haspopup="listbox"]')?.textContent).toContain("Inactivos");
  });

  it("notifica cada cambio del texto de búsqueda con el valor escrito", () => {
    const onQueryChange = vi.fn();
    mounted = mountComponent(
      <ServicesFilters query="" statusFilter="all" onQueryChange={onQueryChange} onStatusFilterChange={vi.fn()} />
    );

    const search = mounted.container.querySelector<HTMLInputElement>(SEARCH_SELECTOR);
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "Color");

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith("Color");
  });

  it("notifica el estado elegido en el selector de estado", () => {
    const onStatusFilterChange = vi.fn();
    mounted = mountComponent(
      <ServicesFilters query="" statusFilter="all" onQueryChange={vi.fn()} onStatusFilterChange={onStatusFilterChange} />
    );

    chooseSelectOptionByCurrentText(mounted.container, "Todos los estados", "Activos");

    expect(onStatusFilterChange).toHaveBeenCalledWith("active");
    expect(onStatusFilterChange).toHaveBeenCalledTimes(1);
  });

  it("ofrece las tres opciones de estado en el listado", () => {
    mounted = mountComponent(
      <ServicesFilters query="" statusFilter="all" onQueryChange={vi.fn()} onStatusFilterChange={vi.fn()} />
    );

    const trigger = mounted.container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
    if (!trigger) throw new Error("falta el selector de estado");
    click(trigger);
    const options = Array.from(document.body.querySelectorAll('[role="option"]')).map((option) => option.textContent);

    expect(options).toEqual(["Activos", "Inactivos"]);
  });
});
