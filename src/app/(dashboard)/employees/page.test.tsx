// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getEmployeesPage, type EmployeesPageViewModel } from "@/features/employees/use-cases/get-employees-page";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import EmployeesPage from "./page";
import { EmployeesManager } from "./employees-manager";

vi.mock("@/app/_composition/request-context", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  isEffectiveSalonModuleEnabled: vi.fn(),
}));

vi.mock("@/features/employees/use-cases/get-employees-page", () => ({
  getEmployeesPage: vi.fn(),
}));

vi.mock("./actions", () => ({
  createEmployeeAction: vi.fn(),
  findArchivedEmployeeByEmailAction: vi.fn(),
  reactivateEmployeeAction: vi.fn(),
}));

const VIEW: EmployeesPageViewModel = {
  employees: [],
  categories: [],
  roles: [{ id: "role-1", name: "Estilista" }],
  mode: "active",
};

describe("EmployeesPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(isEffectiveSalonModuleEnabled).mockReset();
    vi.mocked(getEmployeesPage).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega el acceso sin cargar datos cuando el usuario no puede gestionar colaboradores", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await EmployeesPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar colaboradores.");
    expect(getEmployeesPage).not.toHaveBeenCalled();
  });

  it("carga los colaboradores del salón indicando si el módulo de roles está habilitado", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(getEmployeesPage).mockResolvedValue(VIEW);

    const element = await EmployeesPage();

    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith({ id: "user-1", salon_id: "salon-1" }, "roles");
    expect(getEmployeesPage).toHaveBeenCalledWith({ salonId: "salon-1", rolesEnabled: true, status: "active" });
    expect(element.type).toBe(EmployeesManager);
    expect(element.props).toEqual({
      employees: VIEW.employees,
      categories: VIEW.categories,
      roles: VIEW.roles,
      mode: "active",
    });
  });

  it("pasa rolesEnabled en falso cuando el plan no incluye roles", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
    vi.mocked(getEmployeesPage).mockResolvedValue({ ...VIEW, roles: [] });

    await EmployeesPage();

    expect(getEmployeesPage).toHaveBeenCalledWith({ salonId: "salon-1", rolesEnabled: false, status: "active" });
  });
});
