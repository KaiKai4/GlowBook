import { captureError } from "@/infra/observability";
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

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

describe("registro de errores de nombre", () => {
  it("registra con captureError el fallo de persistencia", async () => {
    const dbError = new Error("caida");
    mockedUpdateName.mockRejectedValue(dbError);

    expect(await updateSalonInfo("salon-1", { name: "Glow" })).toEqual({ ok: false, error: "Error al guardar el nombre del salon." });
    expect(captureError).toHaveBeenCalledWith(dbError, { module: "salon", action: "update_info" });
  });
});
