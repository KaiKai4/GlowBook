import { describe, expect, it } from "vitest";
import {
  clampPage,
  filterCategories,
  getServicesTotals,
  getTotalCategoryPages,
  pageSlice,
} from "./services-manager-data";
import type { Category, ServiceItem } from "./services-types";

function service(id: string, name: string, isActive = true): ServiceItem {
  return {
    id,
    category_id: "cat-1",
    name,
    description: null,
    duration_minutes: 30,
    price: 10,
    is_active: isActive,
    employees: [],
  };
}

const CATEGORIES: Category[] = [
  {
    id: "cat-1",
    name: "Cabello",
    pricing_mode: "fixed",
    services: [service("s1", "Corte dama"), service("s2", "Tinte", false)],
  },
  {
    id: "cat-2",
    name: "Uñas",
    pricing_mode: "variable",
    services: [service("s3", "Manicure")],
  },
];

describe("getServicesTotals", () => {
  it("cuenta categorías, servicios y servicios inactivos", () => {
    expect(getServicesTotals(CATEGORIES)).toEqual({ categories: 2, services: 3, inactiveServices: 1 });
  });
});

describe("filterCategories", () => {
  it("con 'all' y sin filtros devuelve todo", () => {
    expect(filterCategories(CATEGORIES, "all", "", "all")).toEqual(CATEGORIES);
  });

  it("filtra por texto sin distinguir mayúsculas", () => {
    const result = filterCategories(CATEGORIES, "all", "CORTE", "all");

    expect(result.map((category) => category.id)).toEqual(["cat-1"]);
    expect(result[0]?.services.map((item) => item.id)).toEqual(["s1"]);
  });

  it("filtra por estado activo o inactivo", () => {
    const inactive = filterCategories(CATEGORIES, "all", "", "inactive");

    expect(inactive.map((category) => category.id)).toEqual(["cat-1"]);
    expect(inactive[0]?.services.map((item) => item.id)).toEqual(["s2"]);
  });

  it("una categoría activa se mantiene aunque ningún servicio coincida", () => {
    const result = filterCategories(CATEGORIES, "cat-2", "zzz", "all");

    expect(result.map((category) => category.id)).toEqual(["cat-2"]);
    expect(result[0]?.services).toEqual([]);
  });

  it("una categoría no activa sin coincidencias desaparece", () => {
    const result = filterCategories(CATEGORIES, "all", "zzz", "all");

    expect(result).toEqual([]);
  });
});

describe("paginación de categorías", () => {
  it("calcula al menos una página, con tres categorías por página", () => {
    expect(getTotalCategoryPages(0)).toBe(1);
    expect(getTotalCategoryPages(3)).toBe(1);
    expect(getTotalCategoryPages(4)).toBe(2);
  });

  it("acota la página actual al rango válido", () => {
    expect(clampPage(5, 2)).toBe(2);
    expect(clampPage(1, 2)).toBe(1);
  });

  it("devuelve solo las categorías de la página pedida", () => {
    const items = ["a", "b", "c", "d", "e"];

    expect(pageSlice(items, 1)).toEqual(["a", "b", "c"]);
    expect(pageSlice(items, 2)).toEqual(["d", "e"]);
  });
});
