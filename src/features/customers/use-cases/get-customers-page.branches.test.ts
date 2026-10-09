import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCustomers } from "../data/customers.repo";
import type { Database } from "@/types/database.types";
import { getCustomersPage } from "./get-customers-page";

vi.mock("../data/customers.repo", () => ({
  findCustomers: vi.fn(),
}));

const mockedFindCustomers = vi.mocked(findCustomers);

const customerRow: Database["public"]["Tables"]["customers"]["Row"] = {
  id: "c1",
  salon_id: "salon-1",
  first_name: "Ana",
  last_name: "Perez",
  phone: null,
  email: null,
  birth_date: null,
  notes: "",
  is_temporary: false,
  is_active: true,
  search_name: "perez ana",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

describe("getCustomersPage (normalizacion de parametros)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindCustomers.mockResolvedValue({ data: [], total: 0 });
  });

  it.each([
    ["sin pagina", undefined, 1],
    ["pagina no numerica", "abc", 1],
    ["pagina cero", "0", 1],
    ["pagina negativa", "-4", 1],
    ["pagina fraccionaria", "2.5", 1],
    ["pagina valida", "3", 3],
  ])("normaliza la pagina: %s", async (_label, rawPage, expectedPage) => {
    const view = await getCustomersPage({ salonId: "salon-1", page: rawPage });

    expect(view.page).toBe(expectedPage);
    expect(mockedFindCustomers).toHaveBeenCalledWith("salon-1", expect.objectContaining({ page: expectedPage }));
  });

  it("muestra clientes activos por defecto y archivados solo con status 'archived'", async () => {
    const active = await getCustomersPage({ salonId: "salon-1" });
    expect(active).toMatchObject({ mode: "active", isArchived: false });
    expect(mockedFindCustomers).toHaveBeenLastCalledWith("salon-1", expect.objectContaining({ isActive: true }));

    const archived = await getCustomersPage({ salonId: "salon-1", status: "archived" });
    expect(archived).toMatchObject({ mode: "archived", isArchived: true });
    expect(mockedFindCustomers).toHaveBeenLastCalledWith("salon-1", expect.objectContaining({ isActive: false }));

    const unknown = await getCustomersPage({ salonId: "salon-1", status: "otro" });
    expect(unknown.mode).toBe("active");
  });

  it("recorta la busqueda y la limita a 100 caracteres", async () => {
    const view = await getCustomersPage({ salonId: "salon-1", q: `   ${"a".repeat(150)}   ` });

    expect(view.query).toBe("a".repeat(100));
    expect(mockedFindCustomers).toHaveBeenCalledWith(
      "salon-1",
      expect.objectContaining({ q: "a".repeat(100) })
    );
  });

  it("usa cadena vacia cuando no hay busqueda", async () => {
    const view = await getCustomersPage({ salonId: "salon-1" });

    expect(view.query).toBe("");
    expect(mockedFindCustomers).toHaveBeenCalledWith("salon-1", expect.objectContaining({ q: "" }));
  });

  it("calcula paginas totales con minimo de una pagina", async () => {
    mockedFindCustomers.mockResolvedValueOnce({ data: [], total: 0 });
    expect((await getCustomersPage({ salonId: "salon-1" })).totalPages).toBe(1);

    mockedFindCustomers.mockResolvedValueOnce({ data: [], total: 10 });
    expect((await getCustomersPage({ salonId: "salon-1" })).totalPages).toBe(1);

    mockedFindCustomers.mockResolvedValueOnce({ data: [], total: 11 });
    expect((await getCustomersPage({ salonId: "salon-1" })).totalPages).toBe(2);
  });

  it("devuelve los clientes y el total de la consulta junto al tamano de pagina", async () => {
    mockedFindCustomers.mockResolvedValue({ data: [customerRow], total: 25 });

    const view = await getCustomersPage({ salonId: "salon-1", page: "2" });

    expect(view).toMatchObject({ customers: [customerRow], total: 25, page: 2, pageSize: 10, totalPages: 3 });
  });
});
