// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomersPageViewModel } from "@/features/customers/use-cases/get-customers-page";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, setFieldValue, submitForm, formOf } from "@/test/ui-people-dom";
import { buildCustomerRow } from "@/test/ui-people-fixtures";
import { CustomersClient } from "./customers-client";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("./actions", () => ({
  createCustomerAction: vi.fn(),
  checkCustomerPhoneAction: vi.fn(),
  findArchivedCustomerByContactAction: vi.fn(),
  reactivateCustomerAction: vi.fn(),
  updateCustomerAction: vi.fn(),
  deleteCustomerAction: vi.fn(),
}));

function buildView(overrides: Partial<CustomersPageViewModel> = {}): CustomersPageViewModel {
  return {
    customers: [buildCustomerRow()],
    total: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    mode: "active",
    isArchived: false,
    query: "",
    ...overrides,
  };
}

const SEARCH_LABEL = "Buscar clientes por nombre, teléfono o correo";

function searchInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${SEARCH_LABEL}"]`);
  if (!input) throw new Error("falta el buscador de clientes");
  return input;
}

describe("CustomersClient", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.replace.mockReset();
    routerMock.refresh.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("resume el total de clientes activos cuando no hay búsqueda", () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ total: 14 })} />);

    expect(mounted.container.querySelector("h1")?.textContent).toBe("Clientes");
    expect(mounted.container.textContent).toContain("14 clientes activos");
  });

  it("pluraliza correctamente los resultados de una búsqueda", () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ query: "ana", total: 1 })} />);
    expect(mounted.container.textContent).toContain("1 resultado");
    expect(mounted.container.textContent).not.toContain("resultados");
  });

  it("muestra el número de resultados en plural cuando hay varios", () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ query: "ana", total: 3 })} />);

    expect(mounted.container.textContent).toContain("3 resultados");
  });

  it("muestra la lista de clientes que devuelve la vista", () => {
    mounted = mountComponent(
      <CustomersClient initialView={buildView({ customers: [buildCustomerRow({ first_name: "Marta", last_name: "Lima" })] })} />
    );

    expect(mounted.container.textContent).toContain("Marta Lima");
  });

  it("muestra un mensaje cuando no hay clientes registrados", () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ customers: [], total: 0 })} />);

    expect(mounted.container.textContent).toContain("Aún no hay clientes.");
  });

  it("muestra un mensaje distinto cuando la búsqueda no tiene coincidencias", () => {
    mounted = mountComponent(
      <CustomersClient initialView={buildView({ customers: [], total: 0, query: "zzz" })} />
    );

    expect(mounted.container.textContent).toContain("No se encontraron clientes.");
  });

  it("no muestra paginación cuando todo cabe en una página", () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ totalPages: 1 })} />);

    expect(mounted.container.textContent).not.toContain("Página");
    expect(Array.from(mounted.container.querySelectorAll("button")).map((button) => button.textContent)).not.toContain(
      "Siguiente"
    );
  });

  it("muestra el rango visible y navega a la página siguiente conservando la búsqueda", () => {
    mounted = mountComponent(
      <CustomersClient
        initialView={buildView({ query: "ana", total: 25, page: 1, totalPages: 3, pageSize: 10 })}
      />
    );

    expect(mounted.container.textContent).toContain("1-10 de 25");
    expect(mounted.container.textContent).toContain("Página 1 de 3");
    expect(buttonWithText(mounted.container, "Anterior").disabled).toBe(true);

    click(buttonWithText(mounted.container, "Siguiente"));

    expect(routerMock.replace).toHaveBeenCalledWith("/customers?q=ana&page=2");
  });

  it("calcula el rango de la última página sin pasar del total", () => {
    mounted = mountComponent(
      <CustomersClient initialView={buildView({ total: 25, page: 3, totalPages: 3, pageSize: 10, customers: [] })} />
    );

    expect(mounted.container.textContent).toContain("21-25 de 25");
    expect(buttonWithText(mounted.container, "Siguiente").disabled).toBe(true);

    click(buttonWithText(mounted.container, "Anterior"));

    expect(routerMock.replace).toHaveBeenCalledWith("/customers?page=2");
  });

  it("busca con el texto recortado y vuelve a la primera página", async () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ totalPages: 1 })} />);

    setFieldValue(searchInput(mounted.container), "  Ana Vega  ");
    await submitForm(formOf(mounted.container));

    expect(routerMock.replace).toHaveBeenCalledWith("/customers?q=Ana+Vega");
  });

  it("al limpiar la búsqueda desde el campo vuelve a la lista completa", () => {
    mounted = mountComponent(
      <CustomersClient initialView={buildView({ query: "ana", total: 1, page: 1 })} />
    );

    setFieldValue(searchInput(mounted.container), "");

    expect(routerMock.replace).toHaveBeenCalledWith("/customers");
  });

  it("enviar la búsqueda vacía restaura la página previa a la búsqueda", async () => {
    mounted = mountComponent(
      <CustomersClient initialView={buildView({ query: "ana", total: 25, page: 2, totalPages: 3 })} />
    );

    setFieldValue(searchInput(mounted.container), "   ");
    await submitForm(formOf(mounted.container));

    expect(routerMock.replace).toHaveBeenLastCalledWith("/customers?page=2");
  });

  it("no navega al borrar el texto cuando no había una búsqueda activa", () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ query: "" })} />);

    setFieldValue(searchInput(mounted.container), "a");
    setFieldValue(searchInput(mounted.container), "");

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("expone el estado ocupado de la lista mientras se navega", () => {
    mounted = mountComponent(<CustomersClient initialView={buildView({ totalPages: 1 })} />);

    expect(mounted.container.querySelector('[aria-busy="false"]')).not.toBeNull();
  });
});
