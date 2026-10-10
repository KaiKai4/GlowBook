import { afterEach, describe, expect, it, vi } from "vitest";
import { captureError } from ".";
import { scheduleObservabilityWebhook } from "./webhook";

// Este archivo aisla el fallo de emision: el webhook lanza de forma sincrona,
// asi que el catch de emitError se ejecuta. Se fuerza la consola activa.
vi.mock("./webhook", () => ({
  scheduleObservabilityWebhook: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.reject(new Error("headers was called outside a request scope")),
}));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.mocked(scheduleObservabilityWebhook).mockReset();
});

describe("captureError cuando la emision falla", () => {
  it("registra en consola el error original redactado y el fallo de emision", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
    vi.mocked(scheduleObservabilityWebhook).mockImplementation(() => {
      throw new Error("webhook caído");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    captureError(new Error("fallo con password=hunter2 en la cita"), {
      module: "appointments",
      action: "create",
    });
    await flush();

    const failureLine = errorSpy.mock.calls
      .map(([line]) => String(line))
      .find((line) => line.includes("observability_emit_failed"));
    if (!failureLine) throw new Error("No se registró el fallo de emisión.");
    const logged = JSON.parse(failureLine);

    expect(logged.module).toBe("appointments");
    expect(logged.action).toBe("create");
    expect(logged.emitError).toMatchObject({ name: "Error", message: "webhook caído" });
    expect(logged.originalError).toMatchObject({ name: "Error" });
    expect(logged.originalError.message).toContain("fallo con");
    expect(failureLine).not.toContain("hunter2");
  });
});
