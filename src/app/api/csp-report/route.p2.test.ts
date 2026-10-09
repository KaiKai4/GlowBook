import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { captureError } from "@/infra/observability";
import { POST } from "./route";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const LEGACY = "application/csp-report";
const REPORTING = "application/reports+json";
const MAX_BYTES = 16 * 1024;

function report(body: string, contentType: string, extra: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType, ...extra },
    body,
  });
}

function legacyBody(overrides: Record<string, string> = {}) {
  return JSON.stringify({
    "csp-report": {
      "document-uri": "https://app.glowbook.test/login?next=/admin#x",
      "effective-directive": "script-src-elem",
      "blocked-uri": "https://evil.example.com/a.js?token=secreto",
      ...overrides,
    },
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-real-ip": "203.0.113.9" }) as never);
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("POST /api/csp-report: tipo de contenido", () => {
  it("rechaza tipos no soportados con 415 y sin cache", async () => {
    const response = await POST(report("{}", "text/plain"));

    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Tipo de contenido no soportado." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("acepta el tipo con parametros y mayusculas (charset)", async () => {
    const response = await POST(report(legacyBody(), "Application/CSP-Report; charset=utf-8"));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/csp-report: limite de peticiones y tamaño", () => {
  it("limita por IP con el maximo de 30 por minuto y responde 429", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const response = await POST(report(legacyBody(), LEGACY));

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:203.0.113.9:csp-report",
      p_max: 30,
      p_window_seconds: 60,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("rechaza un Content-Length declarado por encima de 16 KiB con 413", async () => {
    const response = await POST(report(legacyBody(), LEGACY, { "content-length": String(MAX_BYTES + 1) }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Informe demasiado grande." });
  });

  it("rechaza un cuerpo real por encima de 16 KiB aunque no declare tamaño", async () => {
    const padding = "x".repeat(MAX_BYTES + 10);
    const body = JSON.stringify({ "csp-report": { "document-uri": padding } });

    const response = await POST(report(body, LEGACY));

    expect(response.status).toBe(413);
  });
});

describe("POST /api/csp-report: contenido del informe", () => {
  it("responde 400 si el cuerpo no es JSON", async () => {
    const response = await POST(report("{no-json", LEGACY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "JSON inválido." });
  });

  it("responde 400 si el JSON no tiene la forma del informe", async () => {
    const response = await POST(report(JSON.stringify({ hola: 1 }), LEGACY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Informe inválido." });
  });

  it("registra un resumen minimo del informe legacy sin query strings y responde 204", async () => {
    const response = await POST(report(legacyBody(), LEGACY));

    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(warnSpy.mock.calls[0]?.[0]));
    expect(logged).toEqual({
      event: "csp_violation",
      directive: "script-src-elem",
      blockedOrigin: "https://evil.example.com",
      documentPath: "/login",
    });
    expect(JSON.stringify(logged)).not.toContain("token=secreto");
    expect(JSON.stringify(logged)).not.toContain("next=/admin");
    expect(captureError).not.toHaveBeenCalled();
  });

  it("registra una violacion por cada informe csp-violation de la Reporting API y omite otros tipos", async () => {
    const body = JSON.stringify([
      { type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "inline", documentURL: "https://app.glowbook.test/salon" } },
      { type: "deprecation", body: {} },
      { type: "csp-violation" },
    ]);

    const response = await POST(report(body, REPORTING));

    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(warnSpy.mock.calls[0]?.[0]));
    expect(first).toEqual({ event: "csp_violation", directive: "img-src", blockedOrigin: "inline", documentPath: "/salon" });
    const second = JSON.parse(String(warnSpy.mock.calls[1]?.[0]));
    expect(second).toEqual({ event: "csp_violation", directive: "unknown", blockedOrigin: "none", documentPath: "none" });
  });

  it("no registra nada cuando la Reporting API solo trae otros tipos", async () => {
    const body = JSON.stringify([{ type: "network-error", body: {} }]);

    const response = await POST(report(body, REPORTING));

    expect(response.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
