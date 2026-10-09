import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";

vi.mock("@/infra/security/rate-limit", () => ({ assertAnonymousRateLimit: vi.fn() }));

const URL_ = "https://app.glowbook.test/api/csp-report";
const LEGACY = "application/csp-report";
const REPORTING = "application/reports+json";

const legacyBody = JSON.stringify({
  "csp-report": {
    "document-uri": "https://app.glowbook.test/clientes/1?x=secreto",
    "effective-directive": "img-src",
    "blocked-uri": "https://img.example.test/a.png?token=abc",
  },
});

function report(contentType: string, body: string, headers: Record<string, string> = {}) {
  return new Request(URL_, { method: "POST", headers: { "content-type": contentType, ...headers }, body });
}

describe("POST /api/csp-report", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(assertAnonymousRateLimit).mockResolvedValue({ ok: true, value: undefined });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("accepts a legacy report, logs only a summary and answers 204 no-store", async () => {
    const response = await POST(report(LEGACY, legacyBody));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(assertAnonymousRateLimit).toHaveBeenCalledWith("csp-report", { max: 30, windowMs: 60_000 });
    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(logged).toContain("img.example.test");
    expect(logged).not.toContain("secreto");
    expect(logged).not.toContain("token=abc");
  });

  it("accepts Reporting API bodies", async () => {
    const body = JSON.stringify([{ type: "csp-violation", body: { effectiveDirective: "script-src", blockedURL: "inline" } }]);

    expect((await POST(report(REPORTING, body))).status).toBe(204);
  });

  it("rejects unsupported content types with 415", async () => {
    const response = await POST(report("application/json", legacyBody));

    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 429 when the anonymous limit is exceeded", async () => {
    vi.mocked(assertAnonymousRateLimit).mockResolvedValue({ ok: false, error: "Demasiados intentos." });

    expect((await POST(report(LEGACY, legacyBody))).status).toBe(429);
  });

  it("rejects bodies declared above 16 KB with 413", async () => {
    const response = await POST(report(LEGACY, legacyBody, { "content-length": String(17 * 1024) }));

    expect(response.status).toBe(413);
  });

  it("returns 400 for invalid JSON and for unexpected shapes", async () => {
    expect((await POST(report(LEGACY, "{no-json"))).status).toBe(400);
    expect((await POST(report(LEGACY, JSON.stringify({ hola: 1 })))).status).toBe(400);
  });
});
