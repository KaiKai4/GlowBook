import { beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveServiceCategory } from "../data/services.repo";
import { validateServiceCategory } from "./validate-service-category";

const MENSAJE = "La categoría no pertenece al salón o está inactiva.";

vi.mock("../data/services.repo", () => ({
  findActiveServiceCategory: vi.fn(),
}));

const mockedFind = vi.mocked(findActiveServiceCategory);

describe("validateServiceCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acepta una categoría activa del salón", async () => {
    mockedFind.mockResolvedValue({ id: "cat-1" });

    await expect(validateServiceCategory("salon-1", "cat-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedFind).toHaveBeenCalledWith("salon-1", "cat-1");
  });

  it.each([
    ["inexistente, ajena o inactiva", null],
  ])("rechaza una categoría %s con mensaje fijo", async (_label, row) => {
    mockedFind.mockResolvedValue(row);

    await expect(validateServiceCategory("salon-1", "cat-x")).resolves.toEqual({
      ok: false,
      error: MENSAJE,
    });
  });

  it("convierte un fallo de la consulta en mensaje generico, sin exponer el original", async () => {
    mockedFind.mockRejectedValue(new Error("caida de red"));

    await expect(validateServiceCategory("salon-1", "cat-1")).resolves.toEqual({
      ok: false,
      error: "No se pudo validar la categoría del servicio.",
    });
  });
});
