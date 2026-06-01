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

  it("redacts known secrets from error messages, stacks and non-sensitive metadata keys", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GLOWBOOK_OBSERVABILITY_WEBHOOK_URL", "https://logs.example.test/glowbook");
    vi.stubEnv("GLOWBOOK_OBSERVABILITY_ENABLE_IN_TESTS", "true");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret-value");

    const error = new Error("request failed authorization=service-role-secret-value");
    error.stack = "Error: token=service-role-secret-value";

    captureError(error, {
      module: "platform",
      action: "delete_salon",
      metadata: {
        message: "service-role-secret-value",
        tags: ["safe", "password=service-role-secret-value"],
      },
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(JSON.stringify(body)).not.toContain("service-role-secret-value");
    expect(body.error.message).toBe("request failed authorization=[redacted]");
    expect(body.error.stack).toBe("Error: token=[redacted]");
    expect(body.metadata.message).toBe("[redacted]");
    expect(body.metadata.tags).toEqual(["safe", "password=[redacted]"]);
  });
});
