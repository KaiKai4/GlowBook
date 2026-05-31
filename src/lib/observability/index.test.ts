import { afterEach, describe, expect, it, vi } from "vitest";
import { captureError, logEvent } from ".";

describe("observability adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not emit console noise while tests are running", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    captureError(new Error("boom"), {
      module: "platform",
      action: "delete_salon",
      metadata: { token: "secret-token", salonId: "salon-1" },
    });
    logEvent("platform.action", {
      module: "platform",
      action: "invite_salon",
      metadata: { serviceRoleKey: "secret-key" },
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("posts redacted payloads to the configured webhook when enabled", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GLOWBOOK_OBSERVABILITY_WEBHOOK_URL", "https://logs.example.test/glowbook");
    vi.stubEnv("GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN", "log-token");
    vi.stubEnv("GLOWBOOK_OBSERVABILITY_ENABLE_IN_TESTS", "true");

    captureError(new Error("boom"), {
      module: "platform",
      action: "delete_salon",
      metadata: { serviceRoleKey: "secret-key", salonId: "salon-1" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://logs.example.test/glowbook",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer log-token",
        },
      })
    );

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(body).toMatchObject({
      level: "error",
      module: "platform",
      action: "delete_salon",
      metadata: {
        serviceRoleKey: "[redacted]",
        salonId: "salon-1",
      },
      error: {
        name: "Error",
        message: "boom",
      },
    });
  });
});
