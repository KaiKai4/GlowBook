import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, createService, updateService } from "../data/services.repo";
import { createServiceCategory } from "./create-category";
import { createCatalogService } from "./create-service";
import { updateCatalogService } from "./update-service";

vi.mock("../data/services.repo", () => ({
  createCategory: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
}));

const mockedCreateCategory = vi.mocked(createCategory);
const mockedCreateService = vi.mocked(createService);
const mockedUpdateService = vi.mocked(updateService);

describe("service catalog use-cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
      error: "Ya existe una categoria con ese nombre.",
    });
  });

  it("keeps service category ownership errors out of the action", async () => {
    mockedCreateService.mockRejectedValue(new Error("La categoria no pertenece al salon."));

    const result = await createCatalogService("salon-1", {
      category_id: "00000000-0000-0000-0000-000000000001",
      name: "Corte",
      description: "",
      duration_minutes: 30,
      price: 15,
    });

    expect(result).toEqual({
      ok: false,
      error: "La categoria no pertenece al salon o esta inactiva.",
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
