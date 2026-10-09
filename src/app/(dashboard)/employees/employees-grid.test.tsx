// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, flushAsync } from "@/test/ui-people-dom";
import { reactivateEmployeeAction } from "./actions";
import { EmployeesGrid } from "./employees-grid";
import type { EmployeeListItem } from "./types";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => toastMock,
}));

vi.mock("./actions", () => ({
  reactivateEmployeeAction: vi.fn(),
}));

const ANA: EmployeeListItem = {
  id: "emp-ana",
  first_name: "Ana",
  last_name: "Vega",
  is_active: true,
  profile_id: "profile-ana",
  serviceCount: 4,
  categories: ["Cabello", "Uñas"],
  categoryIds: ["cat-cabello", "cat-unas"],
};

const LUIS: EmployeeListItem = {
  id: "emp-luis",
  first_name: "Luis",
  last_name: "Pérez",
  is_active: false,
  profile_id: null,
  serviceCount: 0,
  categories: [],
  categoryIds: [],
};

function renderGrid(overrides: Partial<Parameters<typeof EmployeesGrid>[0]> = {}): MountedComponent {
  return mountComponent(
    <EmployeesGrid
      employees={[ANA, LUIS]}
      totalEmployees={2}
      isArchived={false}
      hasActiveFilters={false}
      onClearFilters={vi.fn()}
      {...overrides}
    />
  );
}

describe("EmployeesGrid", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    toastMock.success.mockReset();
    vi.mocked(reactivateEmployeeAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("indica que aún no hay colaboradores cuando el total es cero", () => {
    mounted = renderGrid({ employees: [], totalEmployees: 0 });

    expect(mounted.container.textContent).toContain("Aun no hay colaboradores.");
    expect(mounted.container.querySelector("button")).toBeNull();
  });

  it("indica que no hay coincidencias y ofrece limpiar filtros cuando hay filtros activos", () => {
    const onClearFilters = vi.fn();
    mounted = renderGrid({ employees: [], totalEmployees: 2, hasActiveFilters: true, onClearFilters });

    expect(mounted.container.textContent).toContain("No hay coincidencias.");
    click(buttonWithText(mounted.container, "Limpiar filtros"));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("no ofrece limpiar filtros cuando la lista está vacía sin filtros", () => {
    mounted = renderGrid({ employees: [], totalEmployees: 2, hasActiveFilters: false });

    expect(mounted.container.textContent).toContain("No hay coincidencias.");
    expect(mounted.container.querySelector("button")).toBeNull();
  });

  it("enlaza cada colaborador activo a su ficha con iniciales, categorías y servicios", () => {
    mounted = renderGrid();

    const link = mounted.container.querySelector<HTMLAnchorElement>('a[href="/employees/emp-ana"]');
    expect(link?.textContent).toContain("AV");
    expect(link?.textContent).toContain("Ana Vega");
    expect(link?.textContent).toContain("Cabello · Uñas");
    expect(link?.textContent).toContain("4 servicios");
  });

  it("indica el acceso al sistema según tenga o no perfil vinculado", () => {
    mounted = renderGrid();

    expect(mounted.container.querySelector('span[title="Con acceso al sistema"]')).not.toBeNull();
    expect(mounted.container.querySelector('span[title="Sin acceso al sistema"]')).not.toBeNull();
  });

  it("marca como inactivo al colaborador desactivado y muestra Sin categorías si no tiene", () => {
    mounted = renderGrid();

    expect(mounted.container.textContent).toContain("Inactivo");
    expect(mounted.container.textContent).toContain("Sin categorías");
    expect(mounted.container.querySelector('a[href="/employees/emp-luis"]')?.textContent).toContain("LP");
  });

  it("en modo archivado no enlaza las tarjetas y ofrece reactivar", () => {
    mounted = renderGrid({ isArchived: true, employees: [LUIS], totalEmployees: 1 });

    expect(mounted.container.querySelector("a")).toBeNull();
    expect(buttonWithText(mounted.container, "Reactivar").textContent).toBe("Reactivar");
  });

  it("reactiva un colaborador archivado, avisa con un toast y refresca la vista", async () => {
    vi.mocked(reactivateEmployeeAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderGrid({ isArchived: true, employees: [LUIS], totalEmployees: 1 });

    click(buttonWithText(mounted.container, "Reactivar"));
    await flushAsync();

    expect(reactivateEmployeeAction).toHaveBeenCalledWith("emp-luis");
    expect(toastMock.success).toHaveBeenCalledWith("Colaborador reactivado.");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("muestra en un diálogo el motivo cuando la reactivación falla y lo cierra con Entendido", async () => {
    vi.mocked(reactivateEmployeeAction).mockResolvedValue({
      ok: false,
      error: "Has alcanzado el límite de colaboradores activos de tu plan",
    });
    mounted = renderGrid({ isArchived: true, employees: [LUIS], totalEmployees: 1 });

    click(buttonWithText(mounted.container, "Reactivar"));
    await flushAsync();

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
      "Has alcanzado el límite de colaboradores activos de tu plan"
    );

    click(buttonWithText(document.body, "Entendido"));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
