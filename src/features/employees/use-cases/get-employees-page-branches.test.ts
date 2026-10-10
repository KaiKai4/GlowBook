import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssignableRoleOptions } from "@/features/access/use-cases/role-options";
import { getCategoryServiceOptions } from "@/features/services/use-cases/category-service-options";
import { findEmployeeListRows } from "../data/employees-read.repo";
import { getEmployeesPage } from "./get-employees-page";

// Ramas de la lista de colaboradores: modo archivado frente a activo, filtrado
// de categorías sin referencia y carga de roles según la feature del salón.

vi.mock("../data/employees-read.repo", () => ({
  findEmployeeListRows: vi.fn(),
}));

vi.mock("@/features/services/use-cases/category-service-options", () => ({
  getCategoryServiceOptions: vi.fn(),
}));

vi.mock("@/features/access/use-cases/role-options", () => ({
  getAssignableRoleOptions: vi.fn(),
}));

const SALON_ID = "salon-1";
const mockedFindEmployeeListRows = vi.mocked(findEmployeeListRows);
const mockedCategoryOptions = vi.mocked(getCategoryServiceOptions);
const mockedRoleOptions = vi.mocked(getAssignableRoleOptions);

const row = {
  id: "employee-1",
  first_name: "Ana",
  last_name: "Vega",
  is_active: true,
  profile_id: null,
  services: [{ service_id: "s1" }, { service_id: "s2" }],
  categories: [
    { category: { id: "c1", name: "Cabello" } },
    { category: null },
    { category: { id: "c2", name: "Uñas" } },
  ],
};

describe("get employees page branches", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployeeListRows.mockResolvedValue([]);
    mockedCategoryOptions.mockResolvedValue([]);
    mockedRoleOptions.mockResolvedValue([]);
  });

  it("muestra la lista activa por defecto cuando no hay estado en la URL", async () => {
    const page = await getEmployeesPage({ salonId: SALON_ID, rolesEnabled: false });

    expect(page.mode).toBe("active");
    expect(mockedFindEmployeeListRows).toHaveBeenCalledWith(SALON_ID, true);
  });

  it("trata cualquier estado distinto de 'archived' como activo", async () => {
    await getEmployeesPage({ salonId: SALON_ID, rolesEnabled: false, status: "inactive" });

    expect(mockedFindEmployeeListRows).toHaveBeenCalledWith(SALON_ID, true);
  });

  it("en modo archivado pide solo colaboradores inactivos del salón", async () => {
    const page = await getEmployeesPage({
      salonId: SALON_ID,
      rolesEnabled: false,
      status: "archived",
    });

    expect(page.mode).toBe("archived");
    expect(mockedFindEmployeeListRows).toHaveBeenCalledWith(SALON_ID, false);
  });

  it("resume servicios y categorías, descartando categorías sin referencia", async () => {
    mockedFindEmployeeListRows.mockResolvedValue([row] as never);

    const page = await getEmployeesPage({ salonId: SALON_ID, rolesEnabled: false });

    expect(page.employees).toEqual([
      {
        id: "employee-1",
        first_name: "Ana",
        last_name: "Vega",
        is_active: true,
        profile_id: null,
        serviceCount: 2,
        categories: ["Cabello", "Uñas"],
        categoryIds: ["c1", "c2"],
      },
    ]);
  });

  it("maneja colaboradores sin servicios ni categorías", async () => {
    mockedFindEmployeeListRows.mockResolvedValue([
      { ...row, services: [], categories: [] },
    ] as never);

    const page = await getEmployeesPage({ salonId: SALON_ID, rolesEnabled: false });

    expect(page.employees[0]).toMatchObject({
      serviceCount: 0,
      categories: [],
      categoryIds: [],
    });
  });

  it("tolera relaciones nulas de servicios y categorías sin contar nada", async () => {
    mockedFindEmployeeListRows.mockResolvedValue([
      { ...row, services: null, categories: null },
    ] as never);

    const page = await getEmployeesPage({ salonId: SALON_ID, rolesEnabled: false });

    expect(page.employees[0]).toMatchObject({
      serviceCount: 0,
      categories: [],
      categoryIds: [],
    });
  });

  it("no consulta roles cuando la feature está desactivada", async () => {
    mockedRoleOptions.mockResolvedValue([{ id: "role-1", name: "Caja" }]);

    const page = await getEmployeesPage({ salonId: SALON_ID, rolesEnabled: false });

    expect(mockedRoleOptions).not.toHaveBeenCalled();
    expect(page.roles).toEqual([]);
  });

  it("carga roles asignables y categorías del salón cuando la feature está activa", async () => {
    mockedRoleOptions.mockResolvedValue([{ id: "role-1", name: "Caja" }]);
    mockedCategoryOptions.mockResolvedValue([
      { id: "c1", name: "Cabello", services: [{ id: "s1", name: "Corte" }] },
    ]);

    const page = await getEmployeesPage({ salonId: SALON_ID, rolesEnabled: true });

    expect(mockedRoleOptions).toHaveBeenCalledWith(SALON_ID);
    expect(mockedCategoryOptions).toHaveBeenCalledWith(SALON_ID);
    expect(page.roles).toEqual([{ id: "role-1", name: "Caja" }]);
    expect(page.categories).toEqual([
      { id: "c1", name: "Cabello", services: [{ id: "s1", name: "Corte" }] },
    ]);
  });
});
