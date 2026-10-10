import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getOptimisticAuthDecision, hasSupabaseSessionCookie } from "./proxy-auth";
import { refreshSupabaseSession } from "@/infra/supabase/proxy";
import { proxy } from "./proxy";

vi.mock("./proxy-auth", () => ({
  getOptimisticAuthDecision: vi.fn(),
  hasSupabaseSessionCookie: vi.fn(),
}));
vi.mock("@/infra/supabase/proxy", () => ({ refreshSupabaseSession: vi.fn() }));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INCOMING_ID = "123e4567-e89b-42d3-a456-426614174000";

function requestFor(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

function cspOf(response: NextResponse): string {
  return response.headers.get("Content-Security-Policy") ?? "";
}

function nonceOf(csp: string): string {
  const match = /'nonce-([^']+)'/.exec(csp);
  if (!match?.[1]) throw new Error("La CSP no contiene nonce.");
  return match[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto-test.supabase.co");
  vi.mocked(hasSupabaseSessionCookie).mockReturnValue(false);
  vi.mocked(getOptimisticAuthDecision).mockReturnValue({ type: "next" });
});

describe("proxy: identificador de request", () => {
  it("genera un UUID nuevo cuando no llega x-request-id y lo deja en la request y en la respuesta", async () => {
    const request = requestFor("/dashboard");

    const response = await proxy(request);

    const responseId = response.headers.get("x-request-id") ?? "";
    expect(responseId).toMatch(UUID_V4);
    expect(request.headers.get("x-request-id")).toBe(responseId);
  });

  it("reutiliza el x-request-id entrante si es un UUID válido", async () => {
    const response = await proxy(requestFor("/dashboard", { "x-request-id": INCOMING_ID }));

    expect(response.headers.get("x-request-id")).toBe(INCOMING_ID);
  });

  it("sustituye un x-request-id que no es UUID por uno nuevo", async () => {
    const response = await proxy(requestFor("/dashboard", { "x-request-id": "<script>1</script>" }));

    const responseId = response.headers.get("x-request-id") ?? "";
    expect(responseId).toMatch(UUID_V4);
    expect(responseId).not.toBe("<script>1</script>");
  });
});

describe("proxy: Content-Security-Policy con nonce por request", () => {
  it("publica la CSP en la respuesta con el mismo nonce que la request recibe", async () => {
    const request = requestFor("/login");

    const response = await proxy(request);

    const csp = cspOf(response);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(nonceOf(csp)).toMatch(/.+/);
    expect(request.headers.get("x-nonce")).toBe(nonceOf(csp));
    expect(request.headers.get("content-security-policy")).toBe(csp);
  });

  it("genera un nonce distinto en cada peticion", async () => {
    const first = await proxy(requestFor("/login"));
    const second = await proxy(requestFor("/login"));

    expect(nonceOf(cspOf(first))).not.toBe(nonceOf(cspOf(second)));
  });

  it("publica la cabecera Reporting-Endpoints hacia el informe CSP", async () => {
    const response = await proxy(requestFor("/login"));

    expect(response.headers.get("Reporting-Endpoints")).toBe('csp-endpoint="/api/csp-report"');
  });
});

describe("proxy: sesión y decision de acceso", () => {
  it("sin cookie de sesión no refresca la sesión y pasa hasVerifiedSession indefinido", async () => {
    vi.mocked(hasSupabaseSessionCookie).mockReturnValue(false);

    await proxy(requestFor("/dashboard"));

    expect(refreshSupabaseSession).not.toHaveBeenCalled();
    expect(getOptimisticAuthDecision).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/dashboard", hasVerifiedSession: undefined })
    );
  });

  it("con cookie de sesión refresca la sesión y usa su resultado para la decision", async () => {
    vi.mocked(hasSupabaseSessionCookie).mockReturnValue(true);
    const refreshed = NextResponse.next();
    refreshed.headers.set("x-refreshed", "1");
    vi.mocked(refreshSupabaseSession).mockResolvedValue({ response: refreshed, hasVerifiedSession: true } as never);

    const response = await proxy(requestFor("/dashboard"));

    expect(refreshSupabaseSession).toHaveBeenCalledTimes(1);
    expect(getOptimisticAuthDecision).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/dashboard", hasVerifiedSession: true })
    );
    expect(response.headers.get("x-refreshed")).toBe("1");
  });

  it("una redireccion conserva cookies y cabeceras de la sesión refrescada, sin copiar set-cookie como cabecera", async () => {
    vi.mocked(hasSupabaseSessionCookie).mockReturnValue(true);
    const refreshed = NextResponse.next();
    refreshed.cookies.set("sb-access", "token-nuevo", { path: "/" });
    refreshed.headers.set("x-session-meta", "meta");
    vi.mocked(refreshSupabaseSession).mockResolvedValue({ response: refreshed, hasVerifiedSession: false } as never);
    vi.mocked(getOptimisticAuthDecision).mockReturnValue({ type: "redirect", location: "/login" });

    const response = await proxy(requestFor("/dashboard"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
    expect(response.cookies.get("sb-access")?.value).toBe("token-nuevo");
    expect(response.headers.get("x-session-meta")).toBe("meta");
    expect(cspOf(response)).toContain("default-src 'self'");
    expect(response.headers.get("x-request-id")).toMatch(UUID_V4);
  });

  it("una redireccion sin sesión aplica igualmente la CSP y el identificador de request", async () => {
    vi.mocked(getOptimisticAuthDecision).mockReturnValue({ type: "redirect", location: "/" });

    const response = await proxy(requestFor("/login", { "x-request-id": INCOMING_ID }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/");
    expect(response.headers.get("x-request-id")).toBe(INCOMING_ID);
    expect(cspOf(response)).not.toBe("");
  });

  it("pasa la ruta de la peticion a la decision de acceso", async () => {
    await proxy(requestFor("/admin/salons?page=2"));

    expect(getOptimisticAuthDecision).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/admin/salons" })
    );
  });
});
