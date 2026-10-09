import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleObservabilityWebhook } from "./webhook";

const afterMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({
  after: (callback: () => unknown) => afterMock(callback),
}));

const WEBHOOK_URL = "https://logs.example.test/glowbook";
const PAYLOAD = { level: "error", module: "reports", action: "export" };

function stubWebhookEnv(extra: Record<string, string> = {}) {
  vi.stubEnv("GLOWBOOK_OBSERVABILITY_WEBHOOK_URL", WEBHOOK_URL);
  vi.stubEnv("GLOWBOOK_OBSERVABILITY_ENABLE_IN_TESTS", "true");
  for (const [key, value] of Object.entries(extra)) vi.stubEnv(key, value);
}

// Ejecuta el callback que se habria pasado a after() y espera su resultado.
async function runAfterCallback(): Promise<void> {
  const [callback] = afterMock.mock.calls[0] ?? [];
  if (typeof callback !== "function") throw new Error("after() no fue llamado.");
  await callback();
}

describe("scheduleObservabilityWebhook", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    afterMock.mockReset();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
  });

  it("does nothing when no webhook URL is configured", () => {
    scheduleObservabilityWebhook(PAYLOAD);

    expect(afterMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing under test runs unless the test flag enables it", () => {
    vi.stubEnv("GLOWBOOK_OBSERVABILITY_WEBHOOK_URL", WEBHOOK_URL);

    scheduleObservabilityWebhook(PAYLOAD);

    expect(afterMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("schedules the POST with after() so it does not delay the response", () => {
    stubWebhookEnv();

    scheduleObservabilityWebhook(PAYLOAD);

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the JSON payload with content-type and no authorization when no token is set", async () => {
    stubWebhookEnv();

    scheduleObservabilityWebhook(PAYLOAD);
    await runAfterCallback();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(WEBHOOK_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(PAYLOAD);
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the configured token as a bearer authorization header", async () => {
    stubWebhookEnv({ GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN: "wh-token-123456" });

    scheduleObservabilityWebhook(PAYLOAD);
    await runAfterCallback();

    expect(fetchMock.mock.calls[0]?.[1].headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer wh-token-123456",
    });
  });

  it("logs only the status when the webhook rejects the payload, and does not throw", async () => {
    stubWebhookEnv({ NODE_ENV: "production", VITEST: "" });
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    scheduleObservabilityWebhook(PAYLOAD);
    await expect(runAfterCallback()).resolves.toBeUndefined();

    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toEqual({ event: "observability_webhook_rejected", status: 503 });
    expect(logged).not.toContain(WEBHOOK_URL);
  });

  it("logs only the error name when the network fails, and never rejects", async () => {
    stubWebhookEnv({ NODE_ENV: "production", VITEST: "" });
    fetchMock.mockRejectedValue(new TypeError(`fetch failed for ${WEBHOOK_URL}`));

    scheduleObservabilityWebhook(PAYLOAD);
    await expect(runAfterCallback()).resolves.toBeUndefined();

    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toEqual({ event: "observability_webhook_failed", reason: "TypeError" });
    expect(logged).not.toContain(WEBHOOK_URL);
  });

  it("reports an unknown reason when the failure is not an Error instance", async () => {
    stubWebhookEnv({ NODE_ENV: "production", VITEST: "" });
    fetchMock.mockRejectedValue("network down");

    scheduleObservabilityWebhook(PAYLOAD);
    await runAfterCallback();

    expect(JSON.parse(String(warnSpy.mock.calls[0]?.[0]))).toEqual({
      event: "observability_webhook_failed",
      reason: "unknown",
    });
  });

  it("sends immediately when after() is called outside a request scope", async () => {
    stubWebhookEnv();
    afterMock.mockImplementation(() => {
      throw new Error("after was called outside a request scope");
    });

    scheduleObservabilityWebhook(PAYLOAD);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual(PAYLOAD);
  });
});
