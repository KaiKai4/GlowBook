import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSalonName } from "../data/salon.repo";
import { updateSalonInfo } from "./update-salon-info";

vi.mock("../data/salon.repo", () => ({
  updateSalonName: vi.fn(),
}));

const mockedUpdateName = vi.mocked(updateSalonName);

describe("updateSalonInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda el nuevo nombre para el salon del contexto", async () => {
    mockedUpdateName.mockResolvedValue(undefined);

    expect(await updateSalonInfo("salon-1", { name: "Glow Studio" })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedUpdateName).toHaveBeenCalledWith("salon-1", "Glow Studio");
  });

  it("devuelve error de negocio cuando el repositorio falla", async () => {
    mockedUpdateName.mockRejectedValue(new Error("caida"));

    expect(await updateSalonInfo("salon-1", { name: "Glow" })).toEqual({
      ok: false,
      error: "Error al guardar el nombre del salon.",
    });
  });
});
