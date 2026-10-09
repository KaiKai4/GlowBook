import { describe, expect, it, vi } from "vitest";
import { sumRetailSalesTotal } from "../data/retail.repo";
import { getRetailRevenueTotal } from "./retail-revenue";

vi.mock("../data/retail.repo", () => ({
  sumRetailSalesTotal: vi.fn(),
}));

describe("getRetailRevenueTotal", () => {
  it("delega en el repositorio el total de ventas del rango para el salon indicado", async () => {
    vi.mocked(sumRetailSalesTotal).mockResolvedValue(340.75);

    expect(await getRetailRevenueTotal("salon-1", "2026-06-01T00:00:00Z", "2026-06-30T23:59:59Z")).toBe(340.75);
    expect(sumRetailSalesTotal).toHaveBeenCalledWith("salon-1", "2026-06-01T00:00:00Z", "2026-06-30T23:59:59Z");
  });

  it("propaga el error del repositorio sin silenciarlo", async () => {
    const failure = new Error("caida");
    vi.mocked(sumRetailSalesTotal).mockRejectedValue(failure);

    await expect(getRetailRevenueTotal("salon-1", "a", "b")).rejects.toBe(failure);
  });
});
