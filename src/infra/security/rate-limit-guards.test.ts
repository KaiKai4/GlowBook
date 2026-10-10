import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { assertAnonymousRateLimit } from "./rate-limit";

const headersMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

function requestHeaders(values: Record<string, string>) {
  const lower = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

// Simula el almacen compartido: deniega cuando el contador supera el maximo.
function fakeStore(max: number) {
  const counts = new Map<string, number>();
  rpcMock.mockImplementation((_fn: string, args: { p_key: string; p_max: number }) => {
    const next = (counts.get(args.p_key) ?? 0) + 1;
    counts.set(args.p_key, next);
    return Promise.resolve({ data: [{ allowed: next <= max, retry_after_seconds: 1 }], error: null });
  });
}

describe("assertAnonymousRateLimit", () => {
  beforeEach(() => {
    headersMock.mockReset();
    rpcMock.mockReset();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc: rpcMock } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("limits by x-real-ip when running on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    headersMock.mockResolvedValue(
      requestHeaders({ "x-real-ip": "10.0.0.9", "x-forwarded-for": "10.0.0.1" })
    );
    fakeStore(1);

    expect((await assertAnonymousRateLimit("invite", { max: 1, windowMs: 60_000 })).ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:10.0.0.9:invite",
      p_max: 1,
      p_window_seconds: 60,
    });
  });

  it("outside Vercel ignores a client-sent x-real-ip and uses the shared unknown bucket", async () => {
    vi.stubEnv("VERCEL", "");
    headersMock.mockResolvedValue(requestHeaders({ "x-real-ip": "10.0.0.9" }));
    rpcMock.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });

    await assertAnonymousRateLimit("invite", { max: 1, windowMs: 60_000 });

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({
      p_key: "ip:unknown:invite",
    }));
    expect(rpcMock).not.toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({
      p_key: "ip:10.0.0.9:invite",
    }));
  });

  it("on Vercel falls back to the last forwarded IP (the one the nearest proxy appends), trimmed", async () => {
    vi.stubEnv("VERCEL", "1");
    headersMock.mockResolvedValue(requestHeaders({ "x-forwarded-for": "203.0.113.9, 10.0.0.1 , 10.0.0.2 " }));
    fakeStore(2);
    const options = { max: 2, windowMs: 60_000 };

    expect((await assertAnonymousRateLimit("invite", options)).ok).toBe(true);
    expect((await assertAnonymousRateLimit("invite", options)).ok).toBe(true);
    expect(await assertAnonymousRateLimit("invite", options)).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({
      p_key: "ip:10.0.0.2:invite",
    }));
  });

  it("uses the shared ip:unknown bucket when no IP header exists", async () => {
    headersMock.mockResolvedValue(requestHeaders({}));

    await assertAnonymousRateLimit("invite", { max: 1, windowMs: 60_000 });

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({
      p_key: "ip:unknown:invite",
    }));
  });

  it("outside Vercel ignores x-forwarded-for entirely and uses the shared unknown bucket", async () => {
    vi.stubEnv("VERCEL", "");
    headersMock.mockResolvedValue(requestHeaders({ "x-forwarded-for": "203.0.113.9, 10.0.0.2" }));
    fakeStore(1);
    const options = { max: 1, windowMs: 60_000 };

    expect((await assertAnonymousRateLimit("invite", options)).ok).toBe(true);
    expect((await assertAnonymousRateLimit("invite", options)).ok).toBe(false);
    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({
      p_key: "ip:unknown:invite",
    }));
    expect(rpcMock).not.toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({
      p_key: "ip:10.0.0.2:invite",
    }));
  });

  it("treats a blank forwarded header as unknown", async () => {
    headersMock.mockResolvedValue(requestHeaders({ "x-forwarded-for": "   " }));

    await assertAnonymousRateLimit("invite", { max: 1, windowMs: 60_000 });

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({
      p_key: "ip:unknown:invite",
    }));
  });

  it("uses the default of 10 attempts per minute", async () => {
    vi.stubEnv("VERCEL", "1");
    headersMock.mockResolvedValue(requestHeaders({ "x-real-ip": "10.0.0.5" }));
    rpcMock.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });

    await assertAnonymousRateLimit("csp-report");

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:10.0.0.5:csp-report",
      p_max: 10,
      p_window_seconds: 60,
    });
  });
});
