import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSalonBackground as updateSalonBackgroundRow } from "../data/salon.repo";
import { updateSalonBackground } from "./update-salon-background";

vi.mock("../data/salon.repo", () => ({
  updateSalonBackground: vi.fn(),
}));

const mockedUpdateBackground = vi.mocked(updateSalonBackgroundRow);

describe("updateSalonBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["neutral", "colored"])("guarda el estilo de fondo valido '%s'", async (style) => {
    mockedUpdateBackground.mockResolvedValue(undefined);

    expect(await updateSalonBackground("salon-1", style)).toEqual({ ok: true, value: undefined });
    expect(mockedUpdateBackground).toHaveBeenCalledWith("salon-1", style);
  });

  it("rechaza un estilo desconocido sin persistir", async () => {
    expect(await updateSalonBackground("salon-1", "gradient")).toEqual({
      ok: false,
      error: "Estilo de fondo inválido.",
    });
    expect(mockedUpdateBackground).not.toHaveBeenCalled();
  });

  it("devuelve error generico cuando el repositorio falla", async () => {
    mockedUpdateBackground.mockRejectedValue(new Error("caida"));

    expect(await updateSalonBackground("salon-1", "neutral")).toEqual({
      ok: false,
      error: "Error al guardar el fondo.",
    });
  });
});
