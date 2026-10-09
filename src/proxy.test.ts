import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";
import { proxy } from "./proxy";

vi.mock("@/lib/supabase/proxy", () => ({
  refreshSupabaseSession: vi.fn(),
}));

const VALID_ID = "3f2c1a9e-5b7d-4c8e-9a0b-1d2e3f4a5b6c";
const BASE = "https://app.glowbook.test";

function get(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}${path}`, { headers });
}

beforeEach(() => {
  vi.mocked(refreshSupabaseSession).mockReset();
});

describe("proxy security headers", () => {
  it("redirects anonymous users with CSP, reporting and request id headers", async () => {
    const response = await proxy(get("/clientes"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${BASE}/login`);
    expect(response.headers.get("content-security-policy")).toContain("report-uri /api/csp-report");
    expect(response.headers.get("reporting-endpoints")).toBe('csp-endpoint="/api/csp-report"');
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("marks session redirects as no-store, also for api routes", async () => {
    const page = await proxy(get("/clientes"));
    const api = await proxy(get("/api/reports/export"));

    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(api.status).toBe(307);
    expect(api.headers.get("location")).toBe(`${BASE}/login`);
    expect(api.headers.get("cache-control")).toBe("no-store");
  });

  it("builds the redirect from the host the client used behind a proxy, not from localhost", async () => {
    const response = await proxy(
      get("/clientes", {
        host: "salon.example",
        "x-forwarded-host": "salon.example",
        "x-forwarded-proto": "https",
      })
    );

    expect(response.headers.get("location")).toBe("https://salon.example/login");
  });

  it("reuses a valid incoming request id", async () => {
    const response = await proxy(get("/clientes", { "x-request-id": VALID_ID }));

    expect(response.headers.get("x-request-id")).toBe(VALID_ID);
  });

  it("replaces an invalid incoming request id", async () => {
    const response = await proxy(get("/clientes", { "x-request-id": "no-es-uuid" }));

    expect(response.headers.get("x-request-id")).not.toBe("no-es-uuid");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lets the CSP report endpoint through without a session and keeps the headers", async () => {
    const response = await proxy(get("/api/csp-report"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain("report-to csp-endpoint");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });
});

describe("proxy with a Supabase session cookie", () => {
  it("keeps the refreshed response and the security headers for a logged-in user on /login", async () => {
    const refreshed = NextResponse.next();
    refreshed.cookies.set("sb-project-auth-token", "refreshed");
    vi.mocked(refreshSupabaseSession).mockResolvedValue({ response: refreshed, hasVerifiedSession: true });

    const response = await proxy(get("/login", { cookie: "sb-project-auth-token=abc" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${BASE}/`);
    expect(response.headers.get("set-cookie")).toContain("sb-project-auth-token=refreshed");
    expect(response.headers.get("content-security-policy")).toContain("report-uri /api/csp-report");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("passes a logged-in user through on protected routes with the security headers", async () => {
    vi.mocked(refreshSupabaseSession).mockResolvedValue({
      response: NextResponse.next(),
      hasVerifiedSession: true,
    });

    const response = await proxy(get("/clientes", { cookie: "sb-project-auth-token=abc" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("reporting-endpoints")).toBe('csp-endpoint="/api/csp-report"');
  });
});
