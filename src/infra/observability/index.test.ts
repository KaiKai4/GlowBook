import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from ".";

const headersMock = vi.hoisted(() => vi.fn());
const afterMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("next/server", () => ({
  after: (callback: () => unknown) => afterMock(callback),
}));

const REQUEST_ID = "3f2c1a9e-5b7d-4c8e-9a0b-1d2e3f4a5b6c";

// captureError no es async para el llamador: la emision termina en un tick.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function requestHeaders(values: Record<string, string>) {
  const lower = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

function stubWebhook(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GLOWBOOK_OBSERVABILITY_WEBHOOK_URL", "https://logs.example.test/glowbook");
  vi.stubEnv("GLOWBOOK_OBSERVABILITY_ENABLE_IN_TESTS", "true");
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [firstCall] = fetchMock.mock.calls;
  if (!firstCall) throw new Error("fetch no fue llamado.");
  const [, request] = firstCall;
  return JSON.parse(request.body);
}

describe("observability adapter", () => {
  beforeEach(() => {
    // Por defecto no hay contexto de request: after() lanza, como fuera de Next.
    headersMock.mockRejectedValue(new Error("headers was called outside a request scope"));
    afterMock.mockImplementation(() => {
      throw new Error("after was called outside a request scope");
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not emit console noise while tests are running", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    captureError(new Error("boom"), {
      module: "platform",
      action: "delete_salon",
      metadata: { token: "secret-token", salonId: "salon-1" },
    });
    await flush();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("posts redacted payloads to the configured webhook when enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    stubWebhook(fetchMock);
    vi.stubEnv("GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN", "log-token");

    captureError(new Error("boom"), {
      module: "platform",
      action: "delete_salon",
      metadata: { serviceRoleKey: "secret-key", salonId: "salon-1" },
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

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
    expect(sentBody(fetchMock)).toMatchObject({
      level: "error",
      module: "platform",
      action: "delete_salon",
      metadata: { serviceRoleKey: "[redacted]", salonId: "salon-1" },
      error: { name: "Error", message: "boom" },
    });
  });

  it("redacts known secrets from error messages, stacks and non-sensitive metadata keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    stubWebhook(fetchMock);
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
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = sentBody(fetchMock);
    expect(JSON.stringify(body)).not.toContain("service-role-secret-value");
    expect(body.error.message).toBe("request failed authorization=[redacted]");
    expect(body.error.stack).toBe("Error: token=[redacted]");
    expect(body.metadata.message).toBe("[redacted]");
    expect(body.metadata.tags).toEqual(["safe", "password=[redacted]"]);
  });

  it("masks emails and phone numbers inside free text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    stubWebhook(fetchMock);

    captureError(new Error("no se pudo avisar a ana.perez@example.com al +34 612 345 678"), {
      module: "customers",
      action: "notify",
      metadata: { note: "llamar al 600-123-456 el 2026-10-09", contact: "ana@example.com" },
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = sentBody(fetchMock);
    expect(body.error.message).toBe("no se pudo avisar a [email] al [telefono]");
    expect(body.metadata.note).toBe("llamar al [telefono] el 2026-10-09");
    expect(body.metadata.contact).toBe("[email]");
  });

  it("includes a valid request id read from the request headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    stubWebhook(fetchMock);
    headersMock.mockResolvedValue(requestHeaders({ "x-request-id": REQUEST_ID }));

    captureError(new Error("boom"), { module: "reports", action: "export" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(sentBody(fetchMock).requestId).toBe(REQUEST_ID);
  });

  it("omits an invalid request id instead of forwarding it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    stubWebhook(fetchMock);
    headersMock.mockResolvedValue(requestHeaders({ "x-request-id": "no-es-uuid\nforged" }));

    captureError(new Error("boom"), { module: "reports", action: "export" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(sentBody(fetchMock)).not.toHaveProperty("requestId");
  });

  it("sends the webhook through after() when running inside a request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    stubWebhook(fetchMock);
    const scheduled: Array<() => unknown> = [];
    afterMock.mockImplementation((callback: () => unknown) => {
      scheduled.push(callback);
    });

    captureError(new Error("boom"), { module: "reports", action: "export" });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    await scheduled[0]?.();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs a structured warning instead of throwing when the webhook fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Fuera de test la consola queda habilitada: se simula un entorno no-test.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED https://secret.example"), { name: "TypeError" }));
    stubWebhook(fetchMock);
    captureError(new Error("boom"), { module: "reports", action: "export" });
    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());

    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toEqual({ event: "observability_webhook_failed", reason: "TypeError" });
    expect(logged).not.toContain("secret.example");
  });
});
