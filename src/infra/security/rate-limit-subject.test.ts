import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { assertSubjectRateLimit } from "./rate-limit";

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
const EMAIL = "ana@salonluna.com";
const EMAIL_DIGEST = createHash("sha256").update(EMAIL).digest("hex");
const OPTIONS = { max: 2, windowMs: 900_000 };

function requestHeaders(values: Record<string, string>) {
  const lower = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

// Dentro de Vercel la IP del cliente se lee de x-real-ip (ver rate-limit.ts).
beforeEach(() => {
  vi.stubEnv("VERCEL", "1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertSubjectRateLimit", () => {
  beforeEach(() => {
    headersMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc: rpcMock } as never);
    headersMock.mockResolvedValue(requestHeaders({ "x-real-ip": "203.0.113.7" }));
  });

  it("combina la IP del cliente, el ámbito y el sujeto con SHA-256", async () => {
    await assertSubjectRateLimit("sign-in", EMAIL, OPTIONS);

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: `ip:203.0.113.7:sign-in:subject:${EMAIL_DIGEST}`,
      p_max: 2,
      p_window_seconds: 900,
    });
  });

  it("nunca envía el sujeto en claro dentro de la clave", async () => {
    await assertSubjectRateLimit("sign-in", EMAIL, OPTIONS);

    const key = rpcMock.mock.calls[0]?.[1].p_key as string;
    expect(key).not.toContain("salonluna");
    expect(key).not.toContain("@");
  });

  it("dos sujetos desde la misma IP tienen contadores distintos", async () => {
    await assertSubjectRateLimit("sign-in", EMAIL, OPTIONS);
    await assertSubjectRateLimit("sign-in", "otra@salonluna.com", OPTIONS);

    const first = rpcMock.mock.calls[0]?.[1].p_key;
    const second = rpcMock.mock.calls[1]?.[1].p_key;
    expect(first).not.toBe(second);
  });

  it("bloquea cuando el almacén deniega y devuelve el aviso de límite", async () => {
    rpcMock.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 30 }], error: null });

    expect(await assertSubjectRateLimit("sign-in", EMAIL, OPTIONS)).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
  });

  it("sin IP usa el bucket ip:unknown con las mismas opciones", async () => {
    headersMock.mockResolvedValue(requestHeaders({}));

    await assertSubjectRateLimit("sign-in", EMAIL, OPTIONS);

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: `ip:unknown:sign-in:subject:${EMAIL_DIGEST}`,
      p_max: 2,
      p_window_seconds: 900,
    });
  });
});
