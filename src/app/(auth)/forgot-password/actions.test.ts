import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";
import { headers } from "next/headers";
import { requestPasswordReset } from "@/infra/auth/password-auth";
import { err, ok } from "@/infra/result";
import { requestPasswordResetAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/security/rate-limit", () => ({ assertAnonymousRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/infra/auth/password-auth", () => ({ requestPasswordReset: vi.fn() }));

function requestHeaders(values: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(values) as never);
}

beforeEach(() => {
  vi.mocked(assertAnonymousRateLimit).mockResolvedValue(ok(undefined));
  vi.clearAllMocks();
  requestHeaders({ host: "glowbook.app", "x-forwarded-proto": "https" });
  vi.mocked(requestPasswordReset).mockResolvedValue({ error: null });
});

describe("requestPasswordResetAction", () => {
  it("pide el mensaje de correo vacio sin enviar nada", async () => {
    const result = await requestPasswordResetAction("   ");

    expect(result).toEqual(err("Escribe el correo de tu cuenta."));
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("envia el correo recortado y construye el enlace con el origen de la peticion", async () => {
    const result = await requestPasswordResetAction("  ana@salonluna.com ");

    expect(requestPasswordReset).toHaveBeenCalledWith("ana@salonluna.com", "https://glowbook.app");
    expect(result).toEqual(ok(undefined));
  });

  it("usa x-forwarded-host y x-forwarded-proto cuando el proxy los envía", async () => {
    requestHeaders({ host: "interno:3000", "x-forwarded-host": "app.glowbook.es", "x-forwarded-proto": "https" });

    await requestPasswordResetAction("ana@salonluna.com");

    expect(requestPasswordReset).toHaveBeenCalledWith("ana@salonluna.com", "https://app.glowbook.es");
  });

  it("responde siempre con exito aunque Supabase devuelva error (no revela si el correo existe)", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ error: { message: "rate limited" } as never });

    const result = await requestPasswordResetAction("desconocido@correo.com");

    expect(result).toEqual(ok(undefined));
  });

  it("sin cabecera de host usa localhost como origen de respaldo", async () => {
    requestHeaders({});

    await requestPasswordResetAction("ana@salonluna.com");

    expect(requestPasswordReset).toHaveBeenCalledWith("ana@salonluna.com", "http://localhost");
  });
});

describe("requestPasswordResetAction con límite por IP", () => {
  it("si el límite bloquea no envia el correo de recuperacion", async () => {
    vi.mocked(assertAnonymousRateLimit).mockResolvedValue(err("Demasiados intentos. Espera un momento y vuelve a intentarlo."));

    const result = await requestPasswordResetAction("ana@salonluna.com");

    expect(result.ok).toBe(false);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("aplica el límite del restablecimiento con su ambito propio", async () => {
    await requestPasswordResetAction("ana@salonluna.com");

    expect(assertAnonymousRateLimit).toHaveBeenCalledWith("forgot-password", { max: 5, windowMs: 900_000 });
  });
});
