import { captureError } from "@/infra/observability";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveCategory,
  createCategory,
  findActiveServiceCategory,
  updateService,
} from "../data/services.repo";
import { archiveServiceCategory } from "./archive-category";
import { createServiceCategory } from "./create-category";
import { createCatalogService } from "./create-service";
import { updateCatalogService } from "./update-service";

vi.mock("../data/services.repo", () => ({
  archiveCategory: vi.fn(),
  createCategory: vi.fn(),
  createService: vi.fn(),
  findActiveServiceCategory: vi.fn(),
  updateService: vi.fn(),
}));

const mockedArchiveCategory = vi.mocked(archiveCategory);
const mockedCreateCategory = vi.mocked(createCategory);
const mockedUpdateService = vi.mocked(updateService);
const mockedFindActiveCategory = vi.mocked(findActiveServiceCategory);

describe("service catalog use-cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindActiveCategory.mockResolvedValue({ id: "00000000-0000-0000-0000-000000000001" });
  });

  it("creates a category through the Supabase adapter and returns its id", async () => {
    mockedCreateCategory.mockResolvedValue({ id: "category-1" } as never);

    const result = await createServiceCategory("salon-1", {
      name: "Cabello",
      description: "",
      ordering: 0,
    });

    expect(result).toEqual({ ok: true, value: "category-1" });
    expect(mockedCreateCategory).toHaveBeenCalledWith("salon-1", {
      name: "Cabello",
      description: "",
      ordering: 0,
      pricing_mode: "fixed",
    });
  });

  it("maps duplicate category errors to a business message", async () => {
    mockedCreateCategory.mockRejectedValue({ code: "23505", message: "duplicate key" });

    const result = await createServiceCategory("salon-1", {
      name: "Cabello",
      description: "",
      ordering: 0,
    });

    expect(result).toEqual({
      ok: false,
      error: "Ya existe una categoría con ese nombre.",
    });
  });

  it("archives a category without deleting historical relationships", async () => {
    mockedArchiveCategory.mockResolvedValue({ id: "category-1" } as never);

    const result = await archiveServiceCategory("category-1", "salon-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedArchiveCategory).toHaveBeenCalledWith("category-1", "salon-1");
  });

  it("returns a business error when a category cannot be archived", async () => {
    mockedArchiveCategory.mockRejectedValue(new Error("not found"));

    const result = await archiveServiceCategory("category-1", "salon-1");

    expect(result).toEqual({
      ok: false,
      error: "No se pudo archivar la categoría.",
    });
  });

  it("informa que la categoría no pertenece al salón y no crea el servicio", async () => {
    mockedFindActiveCategory.mockResolvedValueOnce(null);

    const result = await createCatalogService("salon-1", {
      category_id: "00000000-0000-0000-0000-000000000001",
      name: "Corte",
      description: "",
      duration_minutes: 30,
      price: 15,
    });

    expect(result).toEqual({
      ok: false,
      error: "La categoría no pertenece al salón o está inactiva.",
    });
  });

  it("updates an existing service through the catalog use-case", async () => {
    mockedUpdateService.mockResolvedValue({ id: "service-1" } as never);

    const result = await updateCatalogService("service-1", "salon-1", {
      name: "Corte premium",
      price: 25,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedUpdateService).toHaveBeenCalledWith("service-1", "salon-1", {
      name: "Corte premium",
      price: 25,
    });
  });
});

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

describe("registro de errores de archivado", () => {
  it("registra con captureError el fallo al archivar la categoría", async () => {
    const dbError = new Error("caida");
    mockedArchiveCategory.mockRejectedValue(dbError);

    expect(await archiveServiceCategory("cat-1", "salon-1")).toEqual({
      ok: false,
      error: "No se pudo archivar la categoría.",
    });
    expect(captureError).toHaveBeenCalledWith(dbError, { module: "services", action: "archive_category" });
  });
});
