import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicError } from "@/infra/public-error";
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

    await expect(validateServiceCategory("salon-1", "cat-1")).resolves.toBeUndefined();
    expect(mockedFind).toHaveBeenCalledWith("salon-1", "cat-1");
  });

  it.each([
    ["inexistente, ajena o inactiva", null],
  ])("rechaza una categoría %s con PublicError de mensaje fijo", async (_label, row) => {
    mockedFind.mockResolvedValue(row);

    const error = await validateServiceCategory("salon-1", "cat-x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicError);
    expect((error as PublicError).message).toBe(MENSAJE);
  });

  it("propaga el error de la consulta sin convertirlo en mensaje de negocio", async () => {
    const dbError = new Error("caida de red");
    mockedFind.mockRejectedValue(dbError);

    await expect(validateServiceCategory("salon-1", "cat-1")).rejects.toBe(dbError);
  });
});
