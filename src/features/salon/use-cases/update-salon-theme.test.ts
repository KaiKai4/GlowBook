import { captureError } from "@/infra/observability";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSalonTheme as updateSalonThemeRow } from "../data/salon.repo";
import { updateSalonTheme } from "./update-salon-theme";

vi.mock("../data/salon.repo", () => ({
  updateSalonTheme: vi.fn(),
}));

const mockedUpdateTheme = vi.mocked(updateSalonThemeRow);

describe("updateSalonTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda un tema valido del catalogo para el salon del contexto", async () => {
    mockedUpdateTheme.mockResolvedValue(undefined);

    const result = await updateSalonTheme("salon-1", "tiffany");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedUpdateTheme).toHaveBeenCalledWith("salon-1", "tiffany");
  });

  it("rechaza un tema fuera del catalogo sin tocar la base de datos", async () => {
    const result = await updateSalonTheme("salon-1", "neon");

    expect(result).toEqual({ ok: false, error: "Tema inválido." });
    expect(mockedUpdateTheme).not.toHaveBeenCalled();
  });

  it("rechaza texto vacio como tema invalido", async () => {
    const result = await updateSalonTheme("salon-1", "");

    expect(result.ok).toBe(false);
    expect(mockedUpdateTheme).not.toHaveBeenCalled();
  });

  it("devuelve error generico cuando el repositorio falla", async () => {
    mockedUpdateTheme.mockRejectedValue(new Error("caida"));

    const result = await updateSalonTheme("salon-1", "violet");

    expect(result).toEqual({ ok: false, error: "Error al guardar la gama de colores." });
  });
});

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

describe("registro de errores de tema", () => {
  it("registra con captureError el fallo de persistencia", async () => {
    const dbError = new Error("caida");
    mockedUpdateTheme.mockRejectedValue(dbError);

    expect(await updateSalonTheme("salon-1", "violet")).toEqual({ ok: false, error: "Error al guardar la gama de colores." });
    expect(captureError).toHaveBeenCalledWith(dbError, { module: "salon", action: "update_theme" });
  });
});
