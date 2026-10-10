import { afterEach, describe, expect, it, vi } from "vitest";
import { captureError } from ".";
import { scheduleObservabilityWebhook } from "./webhook";

// Si ni siquiera se puede serializar el error, el fallo de emision se registra
// con marcadores fijos en lugar de lanzar.
vi.mock("./webhook", () => ({
  scheduleObservabilityWebhook: vi.fn(),
}));

vi.mock("./redaction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./redaction")>();
  return {
    ...actual,
    serializeError: () => {
      throw new Error("no serializable");
    },
  };
});

vi.mock("next/headers", () => ({
  headers: () => Promise.reject(new Error("headers was called outside a request scope")),
}));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("captureError con valores no serializables", () => {
  it("registra marcadores fijos y no lanza", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => captureError(new Error("x"), { module: "salon", action: "update" })).not.toThrow();
    await flush();

    const line = errorSpy.mock.calls
      .map(([value]) => String(value))
      .find((value) => value.includes("observability_emit_failed"));
    if (!line) throw new Error("No se registró el fallo de emisión.");
    const logged = JSON.parse(line);
    expect(logged.emitError).toEqual({ name: "UnserializableError", message: "[no serializable]" });
    expect(logged.originalError).toEqual({ name: "UnserializableError", message: "[no serializable]" });
    expect(vi.mocked(scheduleObservabilityWebhook)).not.toHaveBeenCalled();
  });
});
