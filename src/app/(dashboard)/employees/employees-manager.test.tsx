// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, setFieldValue } from "@/test/ui-people-dom";
import type { CategoryOption, EmployeeListItem, RoleOption } from "./types";
import { EmployeesManager } from "./employees-manager";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("./actions-profile", () => ({
  reactivateEmployeeAction: vi.fn(),
  createEmployeeAction: vi.fn(),
  findArchivedEmployeeByEmailAction: vi.fn(),
}));

const CATEGORIES: CategoryOption[] = [
  { id: "cat-cabello", name: "Cabello", services: [{ id: "svc-corte", name: "Corte" }] },
  { id: "cat-unas", name: "Uñas", services: [{ id: "svc-manicura", name: "Manicura" }] },
];

const ROLES: RoleOption[] = [{ id: "role-estilista", name: "Estilista" }];

const EMPLOYEES: EmployeeListItem[] = [
  {
    id: "emp-ana",
    first_name: "Ana",
    last_name: "Vega",
    is_active: true,
    profile_id: null,
    serviceCount: 1,
    categories: ["Cabello"],
    categoryIds: ["cat-cabello"],
  },
  {
    id: "emp-marta",
    first_name: "Marta",
    last_name: "Lima",
    is_active: true,
    profile_id: "profile-marta",
    serviceCount: 2,
    categories: ["Uñas", "Cabello"],
    categoryIds: ["cat-unas", "cat-cabello"],
  },
  {
    id: "emp-sofia",
    first_name: "Sofía",
    last_name: "Ruiz",
    is_active: true,
    profile_id: null,
    serviceCount: 1,
    categories: ["Uñas"],
    categoryIds: ["cat-unas"],
  },
];

function renderManager(mode: "active" | "archived" = "active", employees = EMPLOYEES): MountedComponent {
  return mountComponent(
    <EmployeesManager employees={employees} categories={CATEGORIES} roles={ROLES} mode={mode} />
  );
}

function visibleNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("a p.font-semibold")).map((name) => name.textContent ?? "");
}

function categoryFilter(container: HTMLElement, name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent === name
  );
  if (!button) throw new Error(`No se encontró el filtro "${name}"`);
  return button;
}

describe("EmployeesManager", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra el título y el conteo de colaboradores sin filtros", () => {
    mounted = renderManager();

    expect(mounted.container.querySelector("h1")?.textContent).toBe("Colaboradores");
    expect(mounted.container.textContent).toContain("3 de 3 colaboradores activos");
    expect(visibleNames(mounted.container)).toEqual(["Ana Vega", "Marta Lima", "Sofía Ruiz"]);
  });

  it("filtra por nombre o apellido sin distinguir mayúsculas", () => {
    mounted = renderManager();

    const search = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Buscar colaborador..."]');
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "LIMA");

    expect(visibleNames(mounted.container)).toEqual(["Marta Lima"]);
    expect(mounted.container.textContent).toContain("1 de 3 colaboradores activos");
  });

  it("también busca por el nombre de sus categorías", () => {
    mounted = renderManager();

    const search = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Buscar colaborador..."]');
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "uñas");

    expect(visibleNames(mounted.container)).toEqual(["Marta Lima", "Sofía Ruiz"]);
  });

  it("filtra por categoría y vuelve a mostrar todos al pulsar la categoría activa de nuevo", () => {
    mounted = renderManager();

    click(categoryFilter(mounted.container, "Uñas"));
    expect(visibleNames(mounted.container)).toEqual(["Marta Lima", "Sofía Ruiz"]);
    expect(categoryFilter(mounted.container, "Uñas").className).toContain("border-brand-400");

    click(categoryFilter(mounted.container, "Uñas"));
    expect(visibleNames(mounted.container)).toEqual(["Ana Vega", "Marta Lima", "Sofía Ruiz"]);
  });

  it("combina búsqueda y categoría, y el botón Todos limpia solo el filtro de categoría", () => {
    mounted = renderManager();

    click(categoryFilter(mounted.container, "Cabello"));
    const search = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Buscar colaborador..."]');
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "marta");
    expect(visibleNames(mounted.container)).toEqual(["Marta Lima"]);

    click(categoryFilter(mounted.container, "Todos"));
    expect(visibleNames(mounted.container)).toEqual(["Marta Lima"]);
    expect(search.value).toBe("marta");
  });

  it("limpia la búsqueda y la categoría desde el estado vacío", () => {
    mounted = renderManager();

    const search = mounted.container.querySelector<HTMLInputElement>('input[placeholder="Buscar colaborador..."]');
    if (!search) throw new Error("falta el buscador");
    setFieldValue(search, "zzz");
    expect(mounted.container.textContent).toContain("No hay coincidencias.");

    click(buttonWithText(mounted.container, "Limpiar filtros"));

    expect(search.value).toBe("");
    expect(visibleNames(mounted.container)).toEqual(["Ana Vega", "Marta Lima", "Sofía Ruiz"]);
  });

  it("abre el diálogo de nuevo colaborador desde el botón principal", () => {
    mounted = renderManager();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    click(buttonWithText(mounted.container, "Nuevo colaborador"));

    expect(document.body.querySelector('[role="dialog"] h2')?.textContent).toBe("Nuevo colaborador");
  });

  it("en modo archivado muestra las tarjetas sin enlaces y permite reactivarlas", () => {
    mounted = renderManager("archived", EMPLOYEES.slice(0, 1));

    expect(mounted.container.querySelector("a")).toBeNull();
    expect(buttonWithText(mounted.container, "Reactivar").textContent).toBe("Reactivar");
  });

  it("la cabecera de la vista archivada dice colaboradores archivados", () => {
    mounted = renderManager("archived", EMPLOYEES.slice(0, 1));

    expect(mounted.container.textContent).toContain("1 de 1 colaboradores archivados");
    expect(mounted.container.textContent).not.toContain("colaboradores activos");
  });
});
