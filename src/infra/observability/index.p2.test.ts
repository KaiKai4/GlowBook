import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from ".";

const headersMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: () => headersMock() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

// Señal de control de Next (p. ej. uso dinamico): getRequestId la relanza y la
// emision debe degradar a un registro minimo sin datos del error original.
function nextControlSignal() {
  return Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("captureError when the emission itself fails", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    headersMock.mockReset();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    errorSpy.mockRestore();
  });

  it("logs a minimal record without the original error and never rejects", async () => {
    headersMock.mockImplementation(() => {
      throw nextControlSignal();
    });

    expect(() =>
      captureError(new Error("contacto ana@salon.test"), { module: "reports", action: "export" })
    ).not.toThrow();
    await flush();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toEqual({
      event: "observability_emit_failed",
      module: "reports",
      action: "export",
    });
    expect(logged).not.toContain("ana@salon.test");
  });
});
