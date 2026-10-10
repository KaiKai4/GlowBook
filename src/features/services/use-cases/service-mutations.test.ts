import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCategory,
  createService,
  findActiveServiceCategory,
  updateCategory,
  updateService,
} from "../data/services.repo";
import { createServiceCategory } from "./create-category";
import { updateServiceCategory } from "./update-category";
import { createCatalogService } from "./create-service";
import { updateCatalogService } from "./update-service";

vi.mock("../data/services.repo", () => ({
  createCategory: vi.fn(),
  createService: vi.fn(),
  findActiveServiceCategory: vi.fn(),
  updateCategory: vi.fn(),
  updateService: vi.fn(),
}));

const mockedCreateCategory = vi.mocked(createCategory);
const mockedUpdateCategory = vi.mocked(updateCategory);
const mockedCreateService = vi.mocked(createService);
const mockedUpdateService = vi.mocked(updateService);
const mockedFindActiveCategory = vi.mocked(findActiveServiceCategory);

const SALON_ID = "salon-1";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000011";
const SERVICE_ID = "00000000-0000-4000-8000-000000000022";

const UNIQUE_VIOLATION = { code: "23505", message: "duplicate key value" };

describe("mutaciones del catalogo de servicios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindActiveCategory.mockResolvedValue({ id: CATEGORY_ID });
  });

  describe("createServiceCategory", () => {
    it("crea la categoria con modo de precio 'fixed' por defecto y devuelve su id", async () => {
      mockedCreateCategory.mockResolvedValue({ id: "cat-1" } as Awaited<ReturnType<typeof createCategory>>);

      const result = await createServiceCategory(SALON_ID, {
        name: "Corte",
        description: "",
        ordering: 0,
      });

      expect(result).toEqual({ ok: true, value: "cat-1" });
      expect(mockedCreateCategory).toHaveBeenCalledWith(SALON_ID, {
        name: "Corte",
        description: "",
        ordering: 0,
        pricing_mode: "fixed",
      });
    });

    it("respeta el modo de precio variable cuando se indica", async () => {
      mockedCreateCategory.mockResolvedValue({ id: "cat-2" } as Awaited<ReturnType<typeof createCategory>>);

      await createServiceCategory(SALON_ID, { name: "Color", pricing_mode: "variable" });

      expect(mockedCreateCategory).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ pricing_mode: "variable" })
      );
    });

    it("informa nombre duplicado cuando la BD rechaza por unicidad", async () => {
      mockedCreateCategory.mockRejectedValue(UNIQUE_VIOLATION);

      expect(await createServiceCategory(SALON_ID, { name: "Corte" })).toEqual({
        ok: false,
        error: "Ya existe una categoria con ese nombre.",
      });
    });

    it("devuelve error generico para otros fallos", async () => {
      mockedCreateCategory.mockRejectedValue(new Error("caida"));

      expect(await createServiceCategory(SALON_ID, { name: "Corte" })).toEqual({
        ok: false,
        error: "Error al crear la categoria.",
      });
    });
  });

  describe("updateServiceCategory", () => {
    it("actualiza la categoria del salon con los campos recibidos", async () => {
      mockedUpdateCategory.mockResolvedValue({} as Awaited<ReturnType<typeof updateCategory>>);

      expect(await updateServiceCategory(CATEGORY_ID, SALON_ID, { name: "Color", is_active: false })).toEqual({
        ok: true,
        value: undefined,
      });
      expect(mockedUpdateCategory).toHaveBeenCalledWith(CATEGORY_ID, SALON_ID, {
        name: "Color",
        is_active: false,
      });
    });

    it("informa nombre duplicado y error generico", async () => {
      mockedUpdateCategory.mockRejectedValueOnce(UNIQUE_VIOLATION);
      expect(await updateServiceCategory(CATEGORY_ID, SALON_ID, { name: "Corte" })).toEqual({
        ok: false,
        error: "Ya existe una categoria con ese nombre.",
      });

      mockedUpdateCategory.mockRejectedValueOnce(new Error("caida"));
      expect(await updateServiceCategory(CATEGORY_ID, SALON_ID, { name: "Corte" })).toEqual({
        ok: false,
        error: "Error al actualizar la categoria.",
      });
    });
  });

  describe("createCatalogService", () => {
    const input = {
      category_id: CATEGORY_ID,
      name: "Corte dama",
      description: "",
      duration_minutes: 45,
      price: 20,
    };

    it("crea el servicio en la categoria indicada y devuelve su id", async () => {
      mockedCreateService.mockResolvedValue({ id: SERVICE_ID } as Awaited<ReturnType<typeof createService>>);

      expect(await createCatalogService(SALON_ID, input)).toEqual({ ok: true, value: SERVICE_ID });
      expect(mockedCreateService).toHaveBeenCalledWith(SALON_ID, input);
    });

    it("informa servicio duplicado", async () => {
      mockedCreateService.mockRejectedValue(UNIQUE_VIOLATION);

      expect(await createCatalogService(SALON_ID, input)).toEqual({
        ok: false,
        error: "Ya existe un servicio con ese nombre.",
      });
    });

    it("informa que la categoria no pertenece al salon y no crea el servicio", async () => {
      mockedFindActiveCategory.mockResolvedValueOnce(null);

      expect(await createCatalogService(SALON_ID, input)).toEqual({
        ok: false,
        error: "La categoría no pertenece al salón o está inactiva.",
      });
    });

    it("devuelve error generico para otros fallos", async () => {
      mockedCreateService.mockRejectedValue(new Error("caida"));

      expect(await createCatalogService(SALON_ID, input)).toEqual({
        ok: false,
        error: "Error al crear el servicio.",
      });
    });
  });

  describe("updateCatalogService", () => {
    it("actualiza el servicio del salon con los campos recibidos", async () => {
      mockedUpdateService.mockResolvedValue({} as Awaited<ReturnType<typeof updateService>>);

      expect(await updateCatalogService(SERVICE_ID, SALON_ID, { price: 25 })).toEqual({
        ok: true,
        value: undefined,
      });
      expect(mockedUpdateService).toHaveBeenCalledWith(SERVICE_ID, SALON_ID, { price: 25 });
    });

    it("mapea duplicados, categoria no valida y error generico", async () => {
      mockedUpdateService.mockRejectedValueOnce(UNIQUE_VIOLATION);
      expect(await updateCatalogService(SERVICE_ID, SALON_ID, { name: "x" })).toEqual({
        ok: false,
        error: "Ya existe un servicio con ese nombre.",
      });

      mockedFindActiveCategory.mockResolvedValueOnce(null);
      expect(await updateCatalogService(SERVICE_ID, SALON_ID, { category_id: CATEGORY_ID })).toEqual({
        ok: false,
        error: "La categoría no pertenece al salón o está inactiva.",
      });

      mockedUpdateService.mockRejectedValueOnce(new Error("caida"));
      expect(await updateCatalogService(SERVICE_ID, SALON_ID, { price: 1 })).toEqual({
        ok: false,
        error: "Error al actualizar el servicio.",
      });
    });
  });
});
