import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { runSideEffect } from "./run-side-effect";

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedCapture = vi.mocked(captureError);
const context = { module: "appointments", action: "complete" };

describe("runSideEffect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devuelve el valor cuando el efecto termina bien", async () => {
    const outcome = await runSideEffect("promover cliente", async () => 42, context);

    expect(outcome).toEqual({ ok: true, value: 42 });
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it("captura el error con el contexto y devuelve un aviso sin rechazar", async () => {
    const failure = new Error("boom");

    const outcome = await runSideEffect(
      "promover cliente",
      async () => {
        throw failure;
      },
      { ...context, metadata: { appointment: "a1" } }
    );

    expect(outcome).toEqual({
      ok: false,
      warning: "No se completó el paso «promover cliente».",
    });
    expect(mockedCapture).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "complete",
      metadata: { appointment: "a1", effect: "promover cliente" },
    });
  });

  it("captura también valores no Error lanzados por el efecto", async () => {
    const outcome = await runSideEffect("sincronizar", () => Promise.reject("texto"), context);

    expect(outcome.ok).toBe(false);
    expect(mockedCapture).toHaveBeenCalledWith("texto", expect.objectContaining({ action: "complete" }));
  });
});
