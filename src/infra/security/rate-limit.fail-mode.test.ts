import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { assertAnonymousRateLimit, assertSubjectRateLimit } from "./rate-limit";
import { SIGN_IN_ACCOUNT_POLICY, SIGN_IN_IP_POLICY } from "./rate-limit-policies";

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
const UNAVAILABLE_MESSAGE = "No podemos comprobar tus intentos ahora. Vuelve a intentarlo en unos minutos.";
const failure = { code: "XX000", message: "relation rate_limit_buckets does not exist" };

function requestHeaders(values: Record<string, string>) {
  const lower = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

function storeFails() {
  rpcMock.mockResolvedValue({ data: null, error: failure });
}

describe("rate limit failMode al fallar el almacen", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    headersMock.mockReset();
    headersMock.mockResolvedValue(requestHeaders({ "x-real-ip": "203.0.113.7" }));
    vi.mocked(captureError).mockClear();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc: rpcMock } as never);
    storeFails();
  });

  it("por defecto (open) permite la operacion cuando el almacen falla", async () => {
    expect(await assertAnonymousRateLimit("accept-invitation", { max: 5, windowMs: 60_000 })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("failMode open registra el fallo con severity high y failMode en metadatos", async () => {
    await assertAnonymousRateLimit("accept-invitation", { max: 5, windowMs: 60_000, failMode: "open" });

    expect(captureError).toHaveBeenCalledWith(failure, {
      module: "security",
      action: "rate-limit",
      metadata: { scope: "accept-invitation", failMode: "open", severity: "high" },
    });
  });

  it("failMode closed rechaza la operacion con un mensaje fijo, sin el error del almacen", async () => {
    const result = await assertAnonymousRateLimit("sign-in", { max: 10, windowMs: 60_000, failMode: "closed" });

    expect(result).toEqual({ ok: false, error: UNAVAILABLE_MESSAGE });
    expect(JSON.stringify(result)).not.toContain("rate_limit_buckets");
  });

  it("failMode closed registra el fallo con severity high y failMode closed", async () => {
    await assertAnonymousRateLimit("sign-in", { max: 10, windowMs: 60_000, failMode: "closed" });

    expect(captureError).toHaveBeenCalledWith(failure, {
      module: "security",
      action: "rate-limit",
      metadata: { scope: "sign-in", failMode: "closed", severity: "high" },
    });
  });

  it("failMode closed rechaza tambien cuando no se puede crear el cliente admin", async () => {
    vi.mocked(createSupabaseAdminClient).mockImplementation(() => {
      throw new Error("supabaseUrl is required.");
    });

    expect(await assertAnonymousRateLimit("sign-in", { max: 10, windowMs: 60_000, failMode: "closed" })).toEqual({
      ok: false,
      error: UNAVAILABLE_MESSAGE,
    });
  });

  it("failMode closed rechaza una respuesta vacia del almacen", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    expect(await assertAnonymousRateLimit("sign-in", { max: 10, windowMs: 60_000, failMode: "closed" })).toEqual({
      ok: false,
      error: UNAVAILABLE_MESSAGE,
    });
  });

  it("la politica de inicio de sesion por IP es fail-closed", async () => {
    expect(await assertAnonymousRateLimit("sign-in", SIGN_IN_IP_POLICY)).toEqual({
      ok: false,
      error: UNAVAILABLE_MESSAGE,
    });
  });

  it("la politica de inicio de sesion por cuenta es fail-closed", async () => {
    expect(
      await assertSubjectRateLimit("sign-in", "ana@salonluna.com", SIGN_IN_ACCOUNT_POLICY)
    ).toEqual({ ok: false, error: UNAVAILABLE_MESSAGE });
  });

  it("con el almacen disponible, failMode closed sigue aplicando el limite normal", async () => {
    rpcMock.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 30 }], error: null });

    expect(await assertAnonymousRateLimit("sign-in", { max: 10, windowMs: 60_000, failMode: "closed" })).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
    expect(captureError).not.toHaveBeenCalled();
  });
});
