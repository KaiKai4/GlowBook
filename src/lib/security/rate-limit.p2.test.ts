import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { captureError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertActionRateLimit, assertAnonymousRateLimit } from "./rate-limit";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => ({ rpc })) }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

function setRequestHeaders(values: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(values) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
  setRequestHeaders({});
});

describe("assertActionRateLimit", () => {
  it("permite la accion y consume el bucket del usuario con los limites por defecto", async () => {
    const result = await assertActionRateLimit("user-1", "customers:create");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "user:user-1:customers:create",
      p_max: 60,
      p_window_seconds: 60,
    });
  });

  it("bloquea con el mensaje publico cuando el contador supera el maximo", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const result = await assertActionRateLimit("user-1", "scope");

    expect(result).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("aplica las opciones indicadas, redondea la ventana hacia arriba y tiene minimo de 1 s", async () => {
    await assertActionRateLimit("u", "s", { max: 5, windowMs: 1500 });
    expect(rpc).toHaveBeenLastCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_max: 5, p_window_seconds: 2 })
    );

    await assertActionRateLimit("u", "s", { max: 1, windowMs: 0 });
    expect(rpc).toHaveBeenLastCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_window_seconds: 1 })
    );
  });

  it("limita la ventana al maximo de la RPC (86400 s)", async () => {
    await assertActionRateLimit("u", "s", { max: 1, windowMs: 10 * 86_400_000 });

    expect(rpc).toHaveBeenCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_window_seconds: 86_400 })
    );
  });

  it("sustituye caracteres no seguros de la clave por guiones bajos", async () => {
    await assertActionRateLimit("ana lópez/../x", "admin:save plan");

    expect(rpc).toHaveBeenCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_key: "user:ana_l_pez_.._x:admin:save_plan" })
    );
  });

  it("sustituye la clave por su hash SHA-256 cuando supera 200 caracteres", async () => {
    const userId = "u".repeat(250);
    const raw = `user:${userId}:scope`;

    await assertActionRateLimit(userId, "scope");

    const expectedKey = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
    expect(rpc).toHaveBeenCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_key: expectedKey })
    );
  });

  it("fail-open: si la RPC devuelve error permite la accion y lo registra", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    const result = await assertActionRateLimit("user-1", "scope");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "connection reset" }),
      { module: "security", action: "rate-limit", metadata: { scope: "scope" } }
    );
  });

  it("fail-open: si la respuesta no contiene decision lo trata como fallo del almacen", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const result = await assertActionRateLimit("user-1", "scope");

    expect(result.ok).toBe(true);
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "consume_rate_limit no devolvio decision." }),
      expect.objectContaining({ module: "security", action: "rate-limit" })
    );
  });

  it("fail-open: si la respuesta no es un array tampoco hay decision", async () => {
    rpc.mockResolvedValue({ data: { allowed: false }, error: null });

    const result = await assertActionRateLimit("user-1", "scope");

    expect(result.ok).toBe(true);
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("fail-open: si el cliente de administracion no se puede crear permite la accion", async () => {
    vi.mocked(createSupabaseAdminClient).mockImplementationOnce(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
    });

    const result = await assertActionRateLimit("user-1", "scope");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});

describe("assertAnonymousRateLimit", () => {
  it("limita por IP usando x-real-ip (sin espacios) con el maximo anonimo de 10 por minuto", async () => {
    setRequestHeaders({ "x-real-ip": "  203.0.113.7  ", "x-forwarded-for": "198.51.100.9" });

    const result = await assertAnonymousRateLimit("accept-invitation");

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:203.0.113.7:accept-invitation",
      p_max: 10,
      p_window_seconds: 60,
    });
  });

  it("si x-real-ip esta vacia usa el ultimo valor de x-forwarded-for (el que añade el proxy), no el primero falseable", async () => {
    setRequestHeaders({ "x-real-ip": "   ", "x-forwarded-for": "203.0.113.66, 198.51.100.9" });

    await assertAnonymousRateLimit("csp-report");

    expect(rpc).toHaveBeenCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_key: "ip:198.51.100.9:csp-report" })
    );
  });

  it("sin ninguna cabecera de IP usa el bucket compartido 'unknown'", async () => {
    setRequestHeaders({});

    await assertAnonymousRateLimit("csp-report");

    expect(rpc).toHaveBeenCalledWith(
      "consume_rate_limit",
      expect.objectContaining({ p_key: "ip:unknown:csp-report" })
    );
  });

  it("acepta opciones propias y bloquea con el mensaje publico", async () => {
    setRequestHeaders({ "x-real-ip": "192.0.2.1" });
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const result = await assertAnonymousRateLimit("csp-report", { max: 30, windowMs: 60_000 });

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "ip:192.0.2.1:csp-report",
      p_max: 30,
      p_window_seconds: 60,
    });
    expect(result).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
  });

  it("fail-open ante un fallo de la RPC y registra el error con el ambito", async () => {
    rpc.mockRejectedValue(new Error("timeout"));
    setRequestHeaders({ "x-real-ip": "192.0.2.1" });

    const result = await assertAnonymousRateLimit("join-invitation");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "timeout" }),
      { module: "security", action: "rate-limit", metadata: { scope: "join-invitation" } }
    );
  });
});
