import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServiceCatalog } from "./get-service-catalog";

// Las filas de prueba son parciales a propósito: el doble no replica el tipo de Supabase.
const mockedFindServicesCatalog = vi.hoisted(() => vi.fn());

vi.mock("../data/services.repo", () => ({
  findServicesCatalog: mockedFindServicesCatalog,
}));

function service(overrides: Record<string, unknown> = {}) {
  return {
    id: "svc-1",
    category_id: "cat-1",
    name: "Corte",
    description: null,
    duration_minutes: 30,
    price: "12.50",
    is_active: true,
    employee_services: [],
    ...overrides,
  };
}

describe("getServiceCatalog (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marca como variable solo las categorias con precio variable y el resto como fijas", async () => {
    mockedFindServicesCatalog.mockResolvedValue([
      { id: "c1", name: "Color", pricing_mode: "variable", services: [] },
      { id: "c2", name: "Corte", pricing_mode: "fixed", services: [] },
      { id: "c3", name: "Otros", pricing_mode: null, services: null },
    ]);

    const catalog = await getServiceCatalog("salon-1");

    expect(catalog.map((category) => [category.id, category.pricing_mode])).toEqual([
      ["c1", "variable"],
      ["c2", "fixed"],
      ["c3", "fixed"],
    ]);
    expect(catalog[2]?.services).toEqual([]);
  });

  it("convierte el precio a numero y mantiene la descripcion nula", async () => {
    mockedFindServicesCatalog.mockResolvedValue([
      { id: "c1", name: "Corte", pricing_mode: "fixed", services: [service()] },
    ]);

    const [category] = await getServiceCatalog("salon-1");

    expect(category?.services[0]).toEqual({
      id: "svc-1",
      category_id: "cat-1",
      name: "Corte",
      description: null,
      duration_minutes: 30,
      price: 12.5,
      is_active: true,
      employees: [],
    });
  });

  it("muestra solo colaboradores activos con iniciales en mayusculas", async () => {
    mockedFindServicesCatalog.mockResolvedValue([
      {
        id: "c1",
        name: "Corte",
        pricing_mode: "fixed",
        services: [
          service({
            employee_services: [
              { employee: { id: "e1", first_name: "ana", last_name: "ruiz", is_active: true } },
              { employee: { id: "e2", first_name: "Luis", last_name: "Gomez", is_active: false } },
              { employee: null },
              { employee: { id: "e3", first_name: "", last_name: "Mora", is_active: true } },
            ],
          }),
        ],
      },
    ]);

    const [category] = await getServiceCatalog("salon-1");

    expect(category?.services[0]?.employees).toEqual([
      { id: "e1", initials: "AR", name: "ana ruiz" },
      { id: "e3", initials: "M", name: " Mora" },
    ]);
  });

  it("devuelve lista vacia cuando el salon no tiene categorias", async () => {
    mockedFindServicesCatalog.mockResolvedValue([]);

    expect(await getServiceCatalog("salon-1")).toEqual([]);
  });
});
